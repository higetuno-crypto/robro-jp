-- ========================================
-- robro-jp フェーズ1-5 初期スキーマ
-- CLAUDE.md のスキーマ定義に準拠
-- フェーズ6以降のFK予約（owner_account_id）も含む
-- ========================================

-- ゲームマスタ
CREATE TABLE IF NOT EXISTS games (
  universe_id BIGINT PRIMARY KEY,
  place_id BIGINT,
  name TEXT NOT NULL,
  description TEXT,
  creator_name TEXT,
  creator_type TEXT,                        -- 'User' or 'Group'
  thumbnail_url TEXT,
  is_japanese BOOLEAN DEFAULT FALSE,
  japanese_score REAL DEFAULT 0,
  -- 将来の拡張用：開発者登録機能で使う（フェーズ6以降でaccountsテーブル作成後にFK化）
  owner_account_id BIGINT,
  is_verified_by_us BOOLEAN DEFAULT FALSE,  -- 自前認証
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_is_japanese ON games(is_japanese);
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);
CREATE INDEX IF NOT EXISTS idx_games_owner ON games(owner_account_id);

-- 時系列スナップショット（5〜10分刻みで蓄積）
CREATE TABLE IF NOT EXISTS game_snapshots (
  universe_id BIGINT REFERENCES games(universe_id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL,
  playing INT NOT NULL,
  visits BIGINT,
  favorites BIGINT,
  PRIMARY KEY (universe_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON game_snapshots(captured_at DESC);

-- ピックアップ（編集者手動）
CREATE TABLE IF NOT EXISTS featured_games (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT REFERENCES games(universe_id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  comment TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  featured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_active ON featured_games(is_active, display_order);

-- ========================================
-- RLS（Row Level Security）
-- 公開読み取りのみ許可、書き込みはService Role Keyからのみ
-- ========================================
ALTER TABLE games           ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_games  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read games"          ON games;
DROP POLICY IF EXISTS "public read game_snapshots" ON game_snapshots;
DROP POLICY IF EXISTS "public read featured_games" ON featured_games;

CREATE POLICY "public read games"          ON games          FOR SELECT USING (true);
CREATE POLICY "public read game_snapshots" ON game_snapshots FOR SELECT USING (true);
CREATE POLICY "public read featured_games" ON featured_games FOR SELECT USING (is_active = true);
