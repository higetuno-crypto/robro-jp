-- ========================================
-- 0015：タグ系テーブルの RLS 追加 ＋ 投票の原子化 RPC
--
-- 経緯：
--   - 0003_tags.sql でタグ系テーブルを作成した際、ENABLE ROW LEVEL SECURITY を
--     失念。anon キー経由で tag_master 改変・game_tag_votes 改ざん・
--     game_tag_vote_logs の fingerprint/account_id 読み取りが可能な状態だった。
--   - lib/tags.ts の castVote が select → JS で +1 → upsert の read-modify-write
--     になっており、同時投票で lost update する。
--   - 重複判定が fingerprint ベースのみで、ログイン済みでも IP/UA 変更で
--     再投票できる余地があった。
--
-- 本 migration の対応：
--   1. tag_master / game_tag_votes / game_tag_vote_logs に RLS を有効化。
--      書き込みは service_role 経由のみ（policy なし）。
--      閲覧は tag_master.is_active=TRUE と game_tag_votes は公開、logs は本人のみ。
--   2. cast_tag_vote RPC を SECURITY DEFINER で追加。
--      アカウント ID があれば account_id ベース、無ければ fingerprint ベースで
--      24h 重複判定。INSERT log + INSERT...ON CONFLICT DO UPDATE で集計を
--      原子的に更新する。
--
-- 既存 0003_tags.sql は書き換えない（拡張ガイドラインに沿って新規 migration で前方差分）。
-- ========================================

-- 1) RLS 有効化
ALTER TABLE tag_master            ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_tag_votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_tag_vote_logs    ENABLE ROW LEVEL SECURITY;

-- tag_master：is_active=TRUE 行のみ公開閲覧。書き込みは service_role 経由のみ
DROP POLICY IF EXISTS "public read active tag_master" ON tag_master;
CREATE POLICY "public read active tag_master"
  ON tag_master FOR SELECT
  USING (is_active = TRUE);

-- game_tag_votes：集計値のみで PII なし、公開閲覧。書き込みは service_role / RPC 経由のみ
DROP POLICY IF EXISTS "public read game_tag_votes" ON game_tag_votes;
CREATE POLICY "public read game_tag_votes"
  ON game_tag_votes FOR SELECT
  USING (true);

-- game_tag_vote_logs：fingerprint・account_id を含むため公開閲覧不可。
-- ログイン済みユーザーは自分の投票履歴だけ閲覧可（取消UIなどの将来用）。
-- 書き込みは service_role / RPC 経由のみ（policy なし）。
DROP POLICY IF EXISTS "user can read own tag vote logs" ON game_tag_vote_logs;
CREATE POLICY "user can read own tag vote logs"
  ON game_tag_vote_logs FOR SELECT
  USING (auth.uid() = account_id);

-- 2) アトミックな投票 RPC
--    引数：universe_id, tag_id, account_id(optional), fingerprint(必須・空文字でも可)
--    返り値：vote_count, confidence_score, is_duplicate
--    挙動：
--      a) account_id が non-null なら account_id ベース・null なら fingerprint ベースで
--         24h 以内の重複票を判定。重複なら is_duplicate=TRUE で現在値を返す。
--      b) 重複でなければ log を INSERT し、game_tag_votes を INSERT...ON CONFLICT DO UPDATE で
--         vote_count を +1（DBの現値を基準に増分するため lost update しない）。
--      c) confidence_score = LEAST(1, vote_count / (vote_count + 10))
CREATE OR REPLACE FUNCTION public.cast_tag_vote(
  p_universe_id BIGINT,
  p_tag_id      TEXT,
  p_account_id  UUID,
  p_fingerprint TEXT
)
RETURNS TABLE (
  vote_count        INT,
  confidence_score  REAL,
  is_duplicate      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  K_CONST   CONSTANT INT := 10;
  v_since   TIMESTAMPTZ;
  v_dup     BOOLEAN := FALSE;
  v_count   INT;
  v_score   REAL;
BEGIN
  IF p_universe_id IS NULL OR p_tag_id IS NULL THEN
    RAISE EXCEPTION 'universe_id and tag_id are required';
  END IF;

  v_since := NOW() - INTERVAL '24 hours';

  -- 重複判定：account_id 優先・無ければ fingerprint
  IF p_account_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM game_tag_vote_logs
       WHERE universe_id = p_universe_id
         AND tag_id      = p_tag_id
         AND account_id  = p_account_id
         AND created_at >= v_since
    ) INTO v_dup;
  ELSIF p_fingerprint IS NOT NULL AND p_fingerprint <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM game_tag_vote_logs
       WHERE universe_id = p_universe_id
         AND tag_id      = p_tag_id
         AND fingerprint = p_fingerprint
         AND created_at >= v_since
    ) INTO v_dup;
  END IF;

  IF v_dup THEN
    SELECT gtv.vote_count, gtv.confidence_score
      INTO v_count, v_score
    FROM game_tag_votes gtv
    WHERE gtv.universe_id = p_universe_id
      AND gtv.tag_id      = p_tag_id;

    RETURN QUERY SELECT
      COALESCE(v_count, 0),
      COALESCE(v_score, 0::REAL),
      TRUE;
    RETURN;
  END IF;

  -- 投票ログを記録
  INSERT INTO game_tag_vote_logs (universe_id, tag_id, account_id, fingerprint)
  VALUES (p_universe_id, p_tag_id, p_account_id, COALESCE(p_fingerprint, ''));

  -- 集計を原子的にインクリメント（lost update 回避）
  INSERT INTO game_tag_votes (universe_id, tag_id, vote_count, confidence_score, last_voted_at)
  VALUES (
    p_universe_id,
    p_tag_id,
    1,
    LEAST(1::REAL, 1::REAL / (1 + K_CONST)),
    NOW()
  )
  ON CONFLICT (universe_id, tag_id) DO UPDATE
    SET vote_count       = game_tag_votes.vote_count + 1,
        confidence_score = LEAST(
          1::REAL,
          (game_tag_votes.vote_count + 1)::REAL
          / ((game_tag_votes.vote_count + 1) + K_CONST)
        ),
        last_voted_at    = NOW()
  RETURNING game_tag_votes.vote_count, game_tag_votes.confidence_score
    INTO v_count, v_score;

  RETURN QUERY SELECT v_count, v_score, FALSE;
END;
$$;

-- 公開 EXECUTE を絞る（誤って anon / authenticated から直接呼ばれないように）
REVOKE EXECUTE ON FUNCTION public.cast_tag_vote(BIGINT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cast_tag_vote(BIGINT, TEXT, UUID, TEXT) TO service_role;
