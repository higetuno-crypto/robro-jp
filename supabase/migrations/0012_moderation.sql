-- ========================================
-- 0012：フェーズ13 軽量モデレーション
--
-- 仕様：feature-spec.md §2.6 / §8（v4 軽量化）
--   H2 短時間大量🔥検出（自動）
--   H4 ユーザー通報UI（受動）
--   H5 BAN公開ログ（透明性）
--
-- v4 方針：決済関連 reason_code（multi_payment_origin 等）は不要
-- ========================================

-- BAN ログ（H5：透明性のため公開）
CREATE TABLE IF NOT EXISTS moderation_ban_logs (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('account','creator','game')),
  target_id BIGINT NOT NULL,                       -- account=UUID不可なのでBIGINTにしない方針：account_id_text 経由で記録
  target_id_text TEXT,                             -- accounts は UUID なのでこちらを使う
  reason_code TEXT NOT NULL CHECK (reason_code IN ('spam_vote','fake_creator','tos_violation','self_promo_abuse','other')),
  reason_detail TEXT NOT NULL,
  banned_by_account_id UUID REFERENCES accounts(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  appeal_status TEXT NOT NULL CHECK (appeal_status IN ('none','submitted','accepted','rejected')) DEFAULT 'none',
  appeal_resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mbl_target ON moderation_ban_logs(target_type, target_id_text, target_id);
CREATE INDEX IF NOT EXISTS idx_mbl_recent ON moderation_ban_logs(banned_at DESC);

-- ユーザー通報
CREATE TABLE IF NOT EXISTS moderation_reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('game','creator','tag')),
  target_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','reviewing','resolved','dismissed')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mr_status ON moderation_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mr_target ON moderation_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_mr_reporter ON moderation_reports(reporter_account_id);

-- 通報3件以上で自動 reviewing に遷移するトリガ
CREATE OR REPLACE FUNCTION public.auto_promote_reports_to_reviewing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM moderation_reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND status = 'open';
  IF cnt >= 3 THEN
    UPDATE moderation_reports SET status = 'reviewing'
      WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND status = 'open';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_reports ON moderation_reports;
CREATE TRIGGER trg_auto_promote_reports
AFTER INSERT ON moderation_reports
FOR EACH ROW EXECUTE FUNCTION public.auto_promote_reports_to_reviewing();

-- RLS
ALTER TABLE moderation_ban_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;

-- BAN ログは誰でも閲覧可（透明性 H5）
DROP POLICY IF EXISTS "ban_logs_public_read" ON moderation_ban_logs;
CREATE POLICY "ban_logs_public_read" ON moderation_ban_logs FOR SELECT USING (true);

-- 通報は本人だけ自分の通報を読めるが、他人の通報は読めない
-- 書き込みは Service Role 経由（API ルートから auth 確認後）
DROP POLICY IF EXISTS "reports_self_read" ON moderation_reports;
CREATE POLICY "reports_self_read" ON moderation_reports
  FOR SELECT USING (auth.uid() = reporter_account_id);

-- ========================================
-- 適用後の動作確認：
--   SELECT * FROM moderation_ban_logs;
--   SELECT * FROM moderation_reports;
-- ========================================
