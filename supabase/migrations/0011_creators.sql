-- ========================================
-- 0011：フェーズ10 クリエイター自薦登録（無料）
--
-- 仕様：feature-spec.md §2.1（games.registered_creator_id）/§2.4（creators, creator_games）
--      / §5（登録フロー・本人確認）
-- 方針：
--   - account_id は UUID（accounts.id ＝ auth.users.id に整合・migration 0004 由来）
--   - Roblox プロフィール description は永続保存しない（Third-Party App Policy
--     「Do not build profiles for Roblox Users」順守）。verification_code の
--     一致判定だけ行い、確認後はコード自体も破棄
--   - games.registered_creator_id は creator_games.is_primary=TRUE の creator_id を
--     反映するキャッシュ列。同期はトリガで自動化
--   - v4 方針により creator_ad_slots / creator_ad_consent / creator_ad_transactions は
--     永続的に作成しない（金銭フロー全廃）
-- ========================================

-- 1) creators 本体
CREATE TABLE IF NOT EXISTS creators (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  self_introduction TEXT NOT NULL DEFAULT '',           -- robro-jp上の自己紹介（Roblox の description とは別物）
  avatar_url TEXT,
  social_links JSONB NOT NULL DEFAULT '[]',             -- [{platform:'x'|'youtube'|'tiktok'|'blog', url:'...'}]
  roblox_profile_url TEXT NOT NULL,                     -- https://www.roblox.com/users/{id}/profile
  roblox_user_id BIGINT,                                -- パース結果（NULLは未パース）
  -- 本人確認
  verification_code TEXT,                               -- 'robro-verify-XXXXXXXX'（24h有効・確認後NULL）
  verification_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  -- メタ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creators_verified
  ON creators(is_verified) WHERE is_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_creators_roblox_user
  ON creators(roblox_user_id) WHERE roblox_user_id IS NOT NULL;
-- 同一 Roblox ユーザーが複数の robro-jp アカウントから verified にならないよう
-- verified 状態の roblox_user_id は一意制約（部分UNIQUE）
CREATE UNIQUE INDEX IF NOT EXISTS uq_creators_verified_roblox_user
  ON creators(roblox_user_id) WHERE is_verified = TRUE AND roblox_user_id IS NOT NULL;

-- 2) creator_games（クリエイターと自薦ゲームの紐付け）
CREATE TABLE IF NOT EXISTS creator_games (
  creator_id BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (creator_id, universe_id)
);
CREATE INDEX IF NOT EXISTS idx_cg_universe
  ON creator_games(universe_id);
CREATE INDEX IF NOT EXISTS idx_cg_primary
  ON creator_games(creator_id, is_primary)
  WHERE is_primary = TRUE;
-- 1ゲームにつき is_primary=TRUE は最大1行
CREATE UNIQUE INDEX IF NOT EXISTS uq_cg_primary_per_game
  ON creator_games(universe_id) WHERE is_primary = TRUE;

-- 3) games への逆引きFK列追加（feature-spec.md §2.1）
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS registered_creator_id BIGINT REFERENCES creators(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_games_creator
  ON games(registered_creator_id) WHERE registered_creator_id IS NOT NULL;

-- 4) creator_games → games.registered_creator_id 同期トリガ
--    is_primary=TRUE の creator_games 行を games の registered_creator_id に反映
CREATE OR REPLACE FUNCTION public.sync_games_registered_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_primary THEN
      UPDATE games SET registered_creator_id = NEW.creator_id
        WHERE universe_id = NEW.universe_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- is_primary が TRUE になった
    IF NEW.is_primary AND NOT COALESCE(OLD.is_primary, FALSE) THEN
      UPDATE games SET registered_creator_id = NEW.creator_id
        WHERE universe_id = NEW.universe_id;
    -- is_primary が FALSE に戻った
    ELSIF NOT NEW.is_primary AND COALESCE(OLD.is_primary, FALSE) THEN
      -- 他に is_primary=TRUE な行が無ければ NULL に戻す
      IF NOT EXISTS (
        SELECT 1 FROM creator_games
         WHERE universe_id = NEW.universe_id
           AND is_primary = TRUE
           AND creator_id <> NEW.creator_id
      ) THEN
        UPDATE games SET registered_creator_id = NULL
          WHERE universe_id = NEW.universe_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_primary THEN
      IF NOT EXISTS (
        SELECT 1 FROM creator_games
         WHERE universe_id = OLD.universe_id
           AND is_primary = TRUE
           AND creator_id <> OLD.creator_id
      ) THEN
        UPDATE games SET registered_creator_id = NULL
          WHERE universe_id = OLD.universe_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_games_registered_creator ON creator_games;
CREATE TRIGGER trg_sync_games_registered_creator
AFTER INSERT OR UPDATE OR DELETE ON creator_games
FOR EACH ROW EXECUTE FUNCTION public.sync_games_registered_creator();

-- 5) updated_at 自動更新（creators）
CREATE OR REPLACE FUNCTION public.touch_creators_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_creators ON creators;
CREATE TRIGGER trg_touch_creators
BEFORE UPDATE ON creators
FOR EACH ROW EXECUTE FUNCTION public.touch_creators_updated_at();

-- 6) RLS
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_games ENABLE ROW LEVEL SECURITY;

-- creators：is_verified=TRUE 行は誰でも閲覧可。未verified の自分の行は本人のみ閲覧可
DROP POLICY IF EXISTS "verified creators are public" ON creators;
CREATE POLICY "verified creators are public"
  ON creators FOR SELECT
  USING (is_verified = TRUE);

DROP POLICY IF EXISTS "user can read own creator row" ON creators;
CREATE POLICY "user can read own creator row"
  ON creators FOR SELECT
  USING (auth.uid() = account_id);

-- 書き込みはサーバー側（Service Role Key）から行う想定なので RLS でクライアント直書き禁止
-- （API ルート経由で本人確認・バリデーション後に INSERT/UPDATE）

-- creator_games：verified なクリエイターの紐付けは公開
DROP POLICY IF EXISTS "verified creator games are public" ON creator_games;
CREATE POLICY "verified creator games are public"
  ON creator_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM creators
       WHERE creators.id = creator_games.creator_id
         AND creators.is_verified = TRUE
    )
  );

DROP POLICY IF EXISTS "user can read own creator games" ON creator_games;
CREATE POLICY "user can read own creator games"
  ON creator_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM creators
       WHERE creators.id = creator_games.creator_id
         AND creators.account_id = auth.uid()
    )
  );

-- ========================================
-- 動作確認用：適用後 SQL
--
--   SELECT id, display_name, is_verified FROM creators ORDER BY id;
--   SELECT * FROM creator_games;
--   SELECT universe_id, registered_creator_id FROM games WHERE registered_creator_id IS NOT NULL;
--
-- 同期トリガの動作確認：
--   1. creators に1行 INSERT（適当な account_id・roblox_profile_url で）
--   2. UPDATE creators SET is_verified=TRUE, verified_at=NOW() WHERE id=...
--   3. INSERT INTO creator_games (creator_id, universe_id, is_primary) VALUES (..., ..., TRUE);
--   4. SELECT registered_creator_id FROM games WHERE universe_id=... → creator_id が入っているはず
--   5. UPDATE creator_games SET is_primary=FALSE → games.registered_creator_id が NULL に戻る
--   6. DELETE FROM creator_games → 同上
-- ========================================
