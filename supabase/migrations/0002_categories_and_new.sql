-- ========================================
-- フェーズ3拡張：カテゴリ別ランキング + 今週の新着
-- - games に genre_l1 / genre_slug を追加（Roblox詳細API由来）
-- - first_seen_at / genre_slug にインデックス追加
-- ========================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS genre_l1 TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS genre_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_games_first_seen_at ON games(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_genre_slug ON games(genre_slug);
