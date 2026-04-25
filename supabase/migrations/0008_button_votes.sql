-- ========================================
-- フェーズ8：3ボタン投票（❤️好き / ⭐お気に入り / 🔥頼むから人来て）
--
-- 上位文書：
--   - higesakusei/idea-evaluation-v3.md §4.A, §10
--   - higesakusei/feature-spec.md §2-4
--   - higesakusei/implementation-workflow.md §3
--
-- 設計方針：
--   - 行動コスト＝情報価値の原理：weight = 0.5 / 1.0 / 2.1
--   - ベイズ平均で少数票の罠を回避（C=50/30, m=0.7/0.5）
--   - 時間減衰半減期7日
--   - 投票ログはイベントログ型（拡張ガイドライン#1）
--   - 列挙型はTEXT+CHECK（拡張ガイドライン#3）
--
-- 既存スキーマとの整合：
--   - accounts は 0004 で UUID ベース既設。本マイグレーションでは ALTER で拡張のみ
--   - role に 'creator' を追加（フェーズ10で creators テーブル稼働時に使用）
-- ========================================

-- 1) accounts に投票関連カラムを追加
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS total_votes_cast INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_creator_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- role CHECK 制約を更新（'creator' を追加）
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_role_check
  CHECK (role IN ('user', 'creator', 'admin'));

-- 2) ボタン投票の集計テーブル（universe×button の一意）
CREATE TABLE IF NOT EXISTS game_button_votes (
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  button_type TEXT NOT NULL CHECK (button_type IN ('like', 'save', 'recommend')),
  vote_count INT NOT NULL DEFAULT 0,
  bayesian_score REAL NOT NULL DEFAULT 0,
  last_voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (universe_id, button_type)
);
CREATE INDEX IF NOT EXISTS idx_gbv_button_score
  ON game_button_votes(button_type, bayesian_score DESC);

-- 3) 投票生ログ（イベントログ型）
CREATE TABLE IF NOT EXISTS game_button_vote_logs (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL,
  button_type TEXT NOT NULL CHECK (button_type IN ('like', 'save', 'recommend')),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,                       -- 万一のアカウント乗っ取り対策
  vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gbvl_account_time
  ON game_button_vote_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbvl_universe_time
  ON game_button_vote_logs(universe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbvl_recent_recommend
  ON game_button_vote_logs(button_type, created_at DESC)
  WHERE button_type = 'recommend';

-- 4) マイリスト（⭐の二重用途。本人のみ可視）
CREATE TABLE IF NOT EXISTS user_savings (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, universe_id)
);
CREATE INDEX IF NOT EXISTS idx_us_account_added
  ON user_savings(account_id, added_at DESC);

-- 5) 集計トリガ：vote_logs の INSERT で button_votes を自動更新
--    ベイズ平均の計算式：
--      C=50, m=0.7 (like)
--      C=30, m=0.5 (save / recommend)
--      score = (C*m + Σvotes) / (C + N)
CREATE OR REPLACE FUNCTION public.update_game_button_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_C INT;
  v_m REAL;
  v_score REAL;
BEGIN
  -- 該当 (universe_id, button_type) の最新 vote_count を集計
  SELECT COALESCE(SUM(vote_value), 0) INTO v_count
  FROM game_button_vote_logs
  WHERE universe_id = NEW.universe_id
    AND button_type = NEW.button_type;

  -- 負数になることはないが念のためゼロ下限
  IF v_count < 0 THEN v_count := 0; END IF;

  -- ベイズ平均パラメータ
  IF NEW.button_type = 'like' THEN
    v_C := 50; v_m := 0.7;
  ELSE
    v_C := 30; v_m := 0.5;
  END IF;
  v_score := (v_C * v_m + v_count) / (v_C + v_count);

  INSERT INTO game_button_votes (universe_id, button_type, vote_count, bayesian_score, last_voted_at)
  VALUES (NEW.universe_id, NEW.button_type, v_count, v_score, NEW.created_at)
  ON CONFLICT (universe_id, button_type) DO UPDATE
    SET vote_count = EXCLUDED.vote_count,
        bayesian_score = EXCLUDED.bayesian_score,
        last_voted_at = EXCLUDED.last_voted_at;

  -- accounts.total_votes_cast も同期（vote_value=1で+1, -1で-1）
  UPDATE accounts
  SET total_votes_cast = total_votes_cast + NEW.vote_value,
      updated_at = NOW()
  WHERE id = NEW.account_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_game_button_votes ON game_button_vote_logs;
CREATE TRIGGER trg_update_game_button_votes
AFTER INSERT ON game_button_vote_logs
FOR EACH ROW EXECUTE FUNCTION public.update_game_button_votes();

-- 6) ランキング表示用のマテリアライズドビュー
--    REFRESH は10分ごとに pg_cron または Vercel Cron で実行
CREATE MATERIALIZED VIEW IF NOT EXISTS game_voting_scores AS
SELECT
  g.universe_id,
  g.name,
  g.is_japanese,
  COALESCE(like_v.bayesian_score, 0)      AS like_score,
  COALESCE(save_v.bayesian_score, 0)      AS save_score,
  COALESCE(rec_v.bayesian_score,  0)      AS recommend_score,
  COALESCE(like_v.vote_count, 0)          AS like_count,
  COALESCE(save_v.vote_count, 0)          AS save_count,
  COALESCE(rec_v.vote_count,  0)          AS recommend_count,
  -- 重み付け合成
  (0.5 * COALESCE(like_v.bayesian_score, 0)
   + 1.0 * COALESCE(save_v.bayesian_score, 0)
   + 2.1 * COALESCE(rec_v.bayesian_score,  0)) AS raw_score,
  -- 時間減衰（最終投票からの日数、半減期7日）
  EXP(
    -EXTRACT(EPOCH FROM (NOW() - GREATEST(
      COALESCE(like_v.last_voted_at, '1970-01-01'::timestamptz),
      COALESCE(save_v.last_voted_at, '1970-01-01'::timestamptz),
      COALESCE(rec_v.last_voted_at,  '1970-01-01'::timestamptz)
    ))) / (7.0 * 86400.0)
  ) AS time_decay,
  COALESCE(like_v.vote_count, 0)
    + COALESCE(save_v.vote_count, 0)
    + COALESCE(rec_v.vote_count, 0) AS total_votes
FROM games g
LEFT JOIN game_button_votes like_v
  ON g.universe_id = like_v.universe_id AND like_v.button_type = 'like'
LEFT JOIN game_button_votes save_v
  ON g.universe_id = save_v.universe_id AND save_v.button_type = 'save'
LEFT JOIN game_button_votes rec_v
  ON g.universe_id = rec_v.universe_id  AND rec_v.button_type = 'recommend';

CREATE UNIQUE INDEX IF NOT EXISTS idx_gvs_universe ON game_voting_scores(universe_id);
CREATE INDEX IF NOT EXISTS idx_gvs_raw ON game_voting_scores(raw_score DESC);
CREATE INDEX IF NOT EXISTS idx_gvs_total ON game_voting_scores(total_votes DESC);
CREATE INDEX IF NOT EXISTS idx_gvs_jp_raw ON game_voting_scores(is_japanese, raw_score DESC);

-- 7) RLS 設定
ALTER TABLE game_button_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_button_vote_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_savings ENABLE ROW LEVEL SECURITY;

-- game_button_votes：閲覧公開、INSERT/UPDATE はトリガからのみ（アプリは直接書き込まない）
DROP POLICY IF EXISTS "button votes are viewable by anyone" ON game_button_votes;
CREATE POLICY "button votes are viewable by anyone"
  ON game_button_votes FOR SELECT USING (true);

-- game_button_vote_logs：閲覧は本人のみ、INSERT は本人のみ
DROP POLICY IF EXISTS "user can read own vote logs" ON game_button_vote_logs;
CREATE POLICY "user can read own vote logs"
  ON game_button_vote_logs FOR SELECT
  USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "user can insert own vote logs" ON game_button_vote_logs;
CREATE POLICY "user can insert own vote logs"
  ON game_button_vote_logs FOR INSERT
  WITH CHECK (auth.uid() = account_id);

-- user_savings：閲覧・INSERT・DELETE は本人のみ
DROP POLICY IF EXISTS "user can read own savings" ON user_savings;
CREATE POLICY "user can read own savings"
  ON user_savings FOR SELECT
  USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "user can manage own savings" ON user_savings;
CREATE POLICY "user can manage own savings"
  ON user_savings FOR ALL
  USING (auth.uid() = account_id)
  WITH CHECK (auth.uid() = account_id);
