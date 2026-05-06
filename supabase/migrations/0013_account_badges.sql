-- フェーズ11：account_badges
-- バッジは accounts.tag_contribution_score 単独ではなく、汎用テーブルで管理する。
-- 拡張時は badge_key を増やすだけで新しいバッジを追加できる。
--
-- v1 で導入する badge_key:
--   tag_artisan   : タグ投票数による職人バッジ（10票ごとに tier+1）
--   first_tagger  : ゲームに最初のタグを付けた回数
--   early_access  : 2026-11-30 までに登録した先行ユーザー

CREATE TABLE IF NOT EXISTS account_badges (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- meta は可変。例：
  --   tag_artisan : {"score": 50, "tier": 5}
  --   first_tagger: {"games": 3, "first_universe_id": 12345}
  --   early_access: {"signed_up_at": "2026-09-01T..."}
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (account_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_account_badges_key
  ON account_badges(badge_key);

-- RLS：自分のバッジは読める（公開バッジなので他人のも公開で良いが、まず安全側で自分のみ）。
-- 書き込みは全部 service role でやる（ユーザー直書きは無し）。
ALTER TABLE account_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_badges select own" ON account_badges;
CREATE POLICY "account_badges select own"
  ON account_badges FOR SELECT
  USING (account_id = auth.uid());

-- 公開閲覧（他人のバッジを見られるようにする：タグ職人ランキング等）
DROP POLICY IF EXISTS "account_badges select public" ON account_badges;
CREATE POLICY "account_badges select public"
  ON account_badges FOR SELECT
  USING (TRUE);
