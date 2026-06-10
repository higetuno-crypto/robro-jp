-- 攻略Tips（集合知型 UGC）MVP-1
-- 仕様：higesakusei/新しい方向性/攻略Tips-MVP設計.md（2026-06-09 確定）
--
-- 方針：
--  - 匿名投稿可（fingerprint をキーにレート/重複判定）。ログインは任意で優遇
--  - 即時公開＋自動禁止語＋投票＋通報＋事後削除（承認制にしない）
--  - 投票は👍のみ／本文 10〜300字／カテゴリ7種
--  - 生IPは本文と物理分離した tip_disclosure_logs に短期保管（発信者情報開示用・3ヶ月で自動削除＝Cron route）
--
-- セキュリティ（拡張ガイドライン#1/#3/#4/#5 準拠）：
--  - 書き込みは service_role 限定の SECURITY DEFINER RPC 経由。
--    anon/authenticated は RPC を直接実行できない（API層の禁止語＋レートを迂回させない）
--  - RLS：公開 read は published Tips のみ。votes/reports/logs/disclosure は公開ポリシー無し＝到達不能
--
-- 反映：このファイル完成後、Supabase に `supabase db push`（または Dashboard の SQL Editor で実行）。
--       本番DBへローカルから直接 push できないため、Yuki が反映する。

-- =========================================================
-- テーブル
-- =========================================================

-- ① Tips本体（公開中の1コツ = 1行）
CREATE TABLE game_strategy_tips (
  tip_id        BIGSERIAL PRIMARY KEY,
  universe_id   BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('early','earn','boss','trick','glossary','controls','other')),
  body_ja       TEXT NOT NULL CHECK (char_length(body_ja) BETWEEN 10 AND 300),
  account_id    UUID REFERENCES accounts(id) ON DELETE SET NULL,   -- 匿名投稿は NULL
  fingerprint   TEXT NOT NULL,                                     -- IP hash + UA hash（重複/荒らし対策）
  status        TEXT NOT NULL DEFAULT 'published'
                CHECK (status IN ('published','hidden','removed')),
  helpful_count INT NOT NULL DEFAULT 0,
  report_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gst_universe_status ON game_strategy_tips(universe_id, status);
CREATE INDEX idx_gst_rank ON game_strategy_tips(universe_id, helpful_count DESC) WHERE status = 'published';
CREATE INDEX idx_gst_fp_time ON game_strategy_tips(fingerprint, created_at DESC);

-- ② 投票（1 fingerprint × 1 tip = 1票）
CREATE TABLE game_strategy_tip_votes (
  tip_id      BIGINT NOT NULL REFERENCES game_strategy_tips(tip_id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  account_id  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tip_id, fingerprint)
);
CREATE INDEX idx_gstv_account ON game_strategy_tip_votes(account_id, created_at DESC);

-- ③ 通報（イベントログ型。管理キューの素）
CREATE TABLE game_strategy_tip_reports (
  id          BIGSERIAL PRIMARY KEY,
  tip_id      BIGINT NOT NULL REFERENCES game_strategy_tips(tip_id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('spam','offensive','wrong_info','offtopic','other')),
  detail      TEXT CHECK (detail IS NULL OR char_length(detail) <= 500),
  fingerprint TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gstr_open ON game_strategy_tip_reports(status, created_at);
CREATE INDEX idx_gstr_tip ON game_strategy_tip_reports(tip_id);

-- ④ 監査ログ（ハッシュ fingerprint・改版/削除履歴。retention 6ヶ月〜1年。発信者情報開示・荒らし解析の補助）
CREATE TABLE game_strategy_tip_logs (
  id          BIGSERIAL PRIMARY KEY,
  tip_id      BIGINT NOT NULL,
  event       TEXT NOT NULL CHECK (event IN ('create','edit','hide','remove','restore')),
  body_ja     TEXT,
  account_id  UUID,
  fingerprint TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gstl_tip ON game_strategy_tip_logs(tip_id, created_at);

-- ⑤ 発信者情報開示専用・生IPログ（本文と物理分離・3ヶ月で自動削除・厳格ロック）
CREATE TABLE tip_disclosure_logs (
  id          BIGSERIAL PRIMARY KEY,
  tip_id      BIGINT NOT NULL REFERENCES game_strategy_tips(tip_id) ON DELETE CASCADE,
  ip_address  INET NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tdl_created ON tip_disclosure_logs(created_at);

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE game_strategy_tips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_strategy_tip_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_strategy_tip_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_strategy_tip_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_disclosure_logs       ENABLE ROW LEVEL SECURITY;

-- 公開 read は「公開中の Tips」だけ。
CREATE POLICY "public read published strategy tips" ON game_strategy_tips
  FOR SELECT USING (status = 'published');

-- votes / reports / logs / disclosure は SELECT ポリシーを張らない
--   → anon / authenticated からは一切到達不能。service_role（サーバ）と所有者のみ。
--   特に tip_disclosure_logs（生IP）は公開経路から完全に隔離する。

-- =========================================================
-- RPC（書き込み）：service_role 限定の SECURITY DEFINER
--   API層（禁止語チェック・レートリミット・ゲーム存在確認）を通った後だけ呼ばれる。
--   anon が直接叩けないよう EXECUTE を service_role に限定する。
-- =========================================================

-- 投稿：本文＋開示IP＋監査ログを 1 トランザクションで原子的に書く（開示ログの取りこぼし防止）
CREATE OR REPLACE FUNCTION post_strategy_tip(
  p_universe_id BIGINT,
  p_category    TEXT,
  p_body        TEXT,
  p_account_id  UUID,
  p_fingerprint TEXT,
  p_ip          INET,
  p_user_agent  TEXT
) RETURNS game_strategy_tips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tip game_strategy_tips;
BEGIN
  INSERT INTO game_strategy_tips (universe_id, category, body_ja, account_id, fingerprint)
  VALUES (p_universe_id, p_category, p_body, p_account_id, p_fingerprint)
  RETURNING * INTO v_tip;

  INSERT INTO tip_disclosure_logs (tip_id, ip_address, user_agent)
  VALUES (v_tip.tip_id, p_ip, p_user_agent);

  INSERT INTO game_strategy_tip_logs (tip_id, event, body_ja, account_id, fingerprint)
  VALUES (v_tip.tip_id, 'create', p_body, p_account_id, p_fingerprint);

  RETURN v_tip;
END;
$$;

-- 投票：重複は無視、初回のみ helpful_count++。返り値 (new_helpful_count, is_duplicate)
CREATE OR REPLACE FUNCTION vote_strategy_tip(
  p_tip_id      BIGINT,
  p_account_id  UUID,
  p_fingerprint TEXT
) RETURNS TABLE (new_helpful_count INT, is_duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows   INT;
  v_count  INT;
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM game_strategy_tips WHERE tip_id = p_tip_id;
  IF v_status IS NULL OR v_status <> 'published' THEN
    RAISE EXCEPTION 'tip not found or not votable';
  END IF;

  INSERT INTO game_strategy_tip_votes (tip_id, fingerprint, account_id)
  VALUES (p_tip_id, p_fingerprint, p_account_id)
  ON CONFLICT (tip_id, fingerprint) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE game_strategy_tips
      SET helpful_count = helpful_count + 1, updated_at = NOW()
      WHERE tip_id = p_tip_id
      RETURNING helpful_count INTO v_count;
    RETURN QUERY SELECT v_count, FALSE;
  ELSE
    SELECT helpful_count INTO v_count FROM game_strategy_tips WHERE tip_id = p_tip_id;
    RETURN QUERY SELECT v_count, TRUE;
  END IF;
END;
$$;

-- 通報：1件記録し report_count++。閾値到達で自動 hidden に退避（事後モデレーション）
CREATE OR REPLACE FUNCTION report_strategy_tip(
  p_tip_id      BIGINT,
  p_reason      TEXT,
  p_detail      TEXT,
  p_fingerprint TEXT
) RETURNS TABLE (new_report_count INT, auto_hidden BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count  INT;
  v_status TEXT;
  v_hidden BOOLEAN := FALSE;
  c_threshold CONSTANT INT := 5;  -- 自動退避の通報数しきい値
BEGIN
  INSERT INTO game_strategy_tip_reports (tip_id, reason, detail, fingerprint)
  VALUES (p_tip_id, p_reason, p_detail, p_fingerprint);

  UPDATE game_strategy_tips
    SET report_count = report_count + 1, updated_at = NOW()
    WHERE tip_id = p_tip_id
    RETURNING report_count, status INTO v_count, v_status;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'tip not found';
  END IF;

  IF v_count >= c_threshold AND v_status = 'published' THEN
    UPDATE game_strategy_tips SET status = 'hidden', updated_at = NOW() WHERE tip_id = p_tip_id;
    INSERT INTO game_strategy_tip_logs (tip_id, event, fingerprint)
    VALUES (p_tip_id, 'hide', 'system:auto_report_threshold');
    v_hidden := TRUE;
  END IF;

  RETURN QUERY SELECT v_count, v_hidden;
END;
$$;

-- EXECUTE を service_role に限定（anon/authenticated からの直接実行を禁止）
REVOKE EXECUTE ON FUNCTION post_strategy_tip(BIGINT,TEXT,TEXT,UUID,TEXT,INET,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION vote_strategy_tip(BIGINT,UUID,TEXT)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION report_strategy_tip(BIGINT,TEXT,TEXT,TEXT)             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION post_strategy_tip(BIGINT,TEXT,TEXT,UUID,TEXT,INET,TEXT) TO service_role;
GRANT  EXECUTE ON FUNCTION vote_strategy_tip(BIGINT,UUID,TEXT)                     TO service_role;
GRANT  EXECUTE ON FUNCTION report_strategy_tip(BIGINT,TEXT,TEXT,TEXT)             TO service_role;

-- 備考：tip_disclosure_logs の自動削除（3ヶ月超）は pg_cron ではなく
--       Vercel Cron route（app/api/cron/purge-disclosure-logs/route.ts）で日次実行する。
--       DELETE FROM tip_disclosure_logs WHERE created_at < now() - interval '3 months';
