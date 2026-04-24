-- ========================================
-- フェーズ6：accounts（最小 = Supabase Auth 連携のみ）
--
-- 方針：
--  - Supabase Auth の auth.users と 1:1。auth.users.id（uuid）を主キー
--  - CLAUDE.md の将来用に予約されていた games.owner_account_id は BIGINT だが、
--    Supabase Auth は UUID を標準。accounts.id は UUID に寄せ、既存の BIGINT 列は
--    将来 migration 0005 で uuid へ移行するか、owner_id (uuid) を別カラムで追加する。
--    → 今回は accounts.id を uuid で作り、games.owner_account_id BIGINT はそのまま予約として残す
--  - role カラムで将来の権限拡張に予約（'user' / 'admin'）
--  - tag_contribution_score は列だけ予約、バッチは別フェーズ（OPS-03）
--  - game_tag_vote_logs.account_id は BIGINT として予約されていたが、ここを uuid に
--    変えると既存データが無いので問題なし。型を uuid に変更する
-- ========================================

-- 1) accounts 本体（auth.users と 1:1）
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  tag_contribution_score REAL NOT NULL DEFAULT 0,  -- OPS-03 バッチで再計算（現状は0固定）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);
CREATE INDEX IF NOT EXISTS idx_accounts_score ON accounts(tag_contribution_score DESC);

-- 2) auth.users に新規行が入ったら accounts に自動挿入するトリガ
--    display_name は raw_user_meta_data.full_name（Google OAuth由来） or email prefix を使う
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1),
      'ユーザー'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) game_tag_vote_logs.account_id を UUID に型変更
--    既存データは全て NULL（匿名投票のみだったため）なので安全
ALTER TABLE game_tag_vote_logs
  DROP COLUMN IF EXISTS account_id;
ALTER TABLE game_tag_vote_logs
  ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gtvl_account
  ON game_tag_vote_logs(account_id)
  WHERE account_id IS NOT NULL;

-- 4) RLS 設定：
--    accounts は閲覧公開、自己更新のみ可。admin は全件操作可
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts are viewable by anyone" ON accounts;
CREATE POLICY "accounts are viewable by anyone"
  ON accounts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "user can update own account" ON accounts;
CREATE POLICY "user can update own account"
  ON accounts FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
