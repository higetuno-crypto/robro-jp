-- ========================================
-- フェーズ7：配信者導線
--
-- - game_streaming_meta：ゲーム別配信メタ（運営手動入力）
-- - stream_slots：用途別スロット（collab/viewer/short/reaction/no-english/loud）
-- - stream_slot_tags：slot → tag_master のマッピング（1対N）
-- - stream_featured_articles：今週の配信ネタ記事
-- - game_share_assets：OG画像キャッシュ（任意）
-- - 配信向けタグ（stream_good, collab_good 等）は既に 0003_tags.sql で投入済
--
-- 拡張ガイドライン：
--  #1 イベントログ型（stream_featured_articles.featured_universe_ids は JSONB）
--  #2 マスタデータのテーブル化（stream_slots をコードに持たない）
--  #3 列挙型は TEXT + CHECK（fit系 / english_barrier / learning_curve / severity）
-- ========================================

-- ゲーム別配信メタ
CREATE TABLE IF NOT EXISTS game_streaming_meta (
  universe_id BIGINT PRIMARY KEY REFERENCES games(universe_id) ON DELETE CASCADE,
  short_pitch_ja TEXT NOT NULL,
  stream_summary_ja TEXT NOT NULL,
  stream_points JSONB NOT NULL DEFAULT '[]'::jsonb,          -- 最大3件
  solo_fit TEXT NOT NULL CHECK (solo_fit IN ('high','mid','low')),
  collab_fit TEXT NOT NULL CHECK (collab_fit IN ('high','mid','low')),
  viewer_participation_fit TEXT NOT NULL CHECK (viewer_participation_fit IN ('high','mid','low')),
  clip_fit TEXT NOT NULL CHECK (clip_fit IN ('high','mid','low')),
  english_barrier TEXT NOT NULL CHECK (english_barrier IN ('low','mid','high')),
  learning_curve TEXT NOT NULL CHECK (learning_curve IN ('easy','normal','hard')),
  first_10min_guide TEXT NOT NULL DEFAULT '',
  why_now_popular TEXT NOT NULL DEFAULT '',
  stream_caution_notes JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id,label,body,severity}]
  recommended_party_size TEXT NOT NULL DEFAULT '',
  average_session_length TEXT NOT NULL DEFAULT '',
  share_card_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  editorial_score_stream INT NOT NULL DEFAULT 0 CHECK (editorial_score_stream BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gsm_editorial ON game_streaming_meta(editorial_score_stream DESC);

-- スロットマスタ
CREATE TABLE IF NOT EXISTS stream_slots (
  slot_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- スロット→タグ
CREATE TABLE IF NOT EXISTS stream_slot_tags (
  slot_key TEXT NOT NULL REFERENCES stream_slots(slot_key) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag_master(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (slot_key, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_sst_tag ON stream_slot_tags(tag_id);

-- 特集記事
CREATE TABLE IF NOT EXISTS stream_featured_articles (
  article_id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  eyecatch_text TEXT,
  featured_universe_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sfa_status_pub ON stream_featured_articles(status, published_at DESC);

-- シェアカードキャッシュ（任意）
CREATE TABLE IF NOT EXISTS game_share_assets (
  asset_id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('og_image','share_card')),
  image_url TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gsa_universe ON game_share_assets(universe_id, asset_type);

-- ========================================
-- stream_slots シード
-- ========================================
INSERT INTO stream_slots (slot_key, display_name, description, sort_order) VALUES
  ('collab',     'コラボで盛り上がる',          '友達と盛り上がれるゲーム',             10),
  ('viewer',     '視聴者参加しやすい',          '視聴者と一緒に遊べる',                 20),
  ('short',      '短時間で盛り上がる',          '1プレイが短くて区切れる',              30),
  ('reaction',   '初見リアクションが取りやすい','初見の反応が取りやすい',               40),
  ('no-english', '英語ほぼ不要で回しやすい',    'UI・ルールに英語がほぼ出ない',         50),
  ('loud',       '叫ぶ系・盛り上がる',          '叫んで楽しいゲーム',                   60)
ON CONFLICT (slot_key) DO NOTHING;

-- ========================================
-- stream_slot_tags マッピング
-- ========================================
INSERT INTO stream_slot_tags (slot_key, tag_id) VALUES
  ('collab',     'collab_good'),
  ('collab',     'voice_chat_plus'),
  ('viewer',     'viewer_join'),
  ('viewer',     'scale_up'),
  ('short',      'short_play'),
  ('short',      'easy_rule'),
  ('reaction',   'reaction_good'),
  ('reaction',   'loud_fun'),
  ('no-english', 'no_english'),
  ('no-english', 'easy_rule'),
  ('loud',       'loud_fun'),
  ('loud',       'reaction_good')
ON CONFLICT DO NOTHING;

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gsm_updated_at ON game_streaming_meta;
CREATE TRIGGER trg_gsm_updated_at BEFORE UPDATE ON game_streaming_meta
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_sfa_updated_at ON stream_featured_articles;
CREATE TRIGGER trg_sfa_updated_at BEFORE UPDATE ON stream_featured_articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
