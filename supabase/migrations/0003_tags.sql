-- ========================================
-- フェーズ6：タグ機能（MVP1）
-- - tag_master：公式タグ・ユーザー選択式タグのマスタ（自由入力はMVPでは封印）
-- - game_tag_votes：ゲーム×タグの集計（vote_count / confidence_score）
-- - game_tag_vote_logs：投票イベントログ（fingerprintベース、account_idは将来用に予約）
-- 拡張ガイドライン準拠：#1 イベントログ型 / #3 TEXT+CHECK制約 / #4 FK列予約
-- ========================================

-- タグマスタ
CREATE TABLE IF NOT EXISTS tag_master (
  tag_id TEXT PRIMARY KEY,
  tag_name TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('official','user_selectable','free')),
  tag_group TEXT NOT NULL CHECK (tag_group IN ('format','reaction','participation','caution','difficulty','vibe','genre')),
  description TEXT,
  is_streaming_related BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tag_active ON tag_master(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_tag_streaming ON tag_master(is_streaming_related) WHERE is_streaming_related = TRUE;
CREATE INDEX IF NOT EXISTS idx_tag_group ON tag_master(tag_group, is_active);

-- タグ投票集計
CREATE TABLE IF NOT EXISTS game_tag_votes (
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag_master(tag_id) ON DELETE CASCADE,
  vote_count INT NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  last_voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (universe_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_gtv_universe ON game_tag_votes(universe_id, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_gtv_tag_conf ON game_tag_votes(tag_id, confidence_score DESC);

-- 投票生ログ（イベントログ型。荒らし検知・取り消し・タグ職人スコアに使用）
CREATE TABLE IF NOT EXISTS game_tag_vote_logs (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag_master(tag_id) ON DELETE CASCADE,
  account_id BIGINT,                         -- 将来：accounts(id) へのFK予約（現状は常にNULL）
  fingerprint TEXT NOT NULL,                 -- IP hash + UA hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gtvl_fp_time ON game_tag_vote_logs(fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gtvl_universe_tag_fp ON game_tag_vote_logs(universe_id, tag_id, fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gtvl_account ON game_tag_vote_logs(account_id) WHERE account_id IS NOT NULL;

-- ========================================
-- 公式タグシード（is_streaming_related=TRUE は配信関連）
-- ========================================
INSERT INTO tag_master (tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, sort_order) VALUES
  -- format（遊び方の形式）
  ('solo_ok',        'ソロでもいける',   'official', 'format', '1人でも楽しめる',              TRUE,  10),
  ('collab_good',    'コラボ向き',       'official', 'format', '友達複数人で盛り上がる',       TRUE,  20),
  ('short_play',     '短時間向き',       'official', 'format', '1プレイが短い',                TRUE,  30),
  ('long_play',      '長時間向き',       'official', 'format', 'じっくり遊ぶ',                 FALSE, 40),
  ('stream_good',    '配信映え',         'official', 'format', '配信で映える',                 TRUE,  50),
  -- difficulty
  ('no_english',     '英語ほぼ不要',     'official', 'difficulty', 'UIやルールに英語が少ない', TRUE,  60),
  ('easy_rule',      'ルール簡単',       'official', 'difficulty', '初見でも理解しやすい',     TRUE,  70),
  ('beginner_ok',    '初心者向け',       'official', 'difficulty', 'Roblox初心者におすすめ',   FALSE, 80),
  -- reaction
  ('reaction_good',  '初見リアクション', 'official', 'reaction', '初見の反応が取りやすい',     TRUE,  90),
  ('loud_fun',       '叫ぶ系',           'official', 'reaction', '盛り上がって叫びたくなる',   TRUE,  100),
  ('slow_burn',      'じわじわ沼る',     'official', 'reaction', '時間を忘れる中毒性',         FALSE, 110),
  -- participation
  ('viewer_join',    '視聴者参加向き',   'official', 'participation', '視聴者と一緒に遊べる',  TRUE,  120),
  ('voice_chat_plus','通話あり推奨',     'official', 'participation', 'ボイチャで楽しさ倍増',  TRUE,  130),
  ('scale_up',       '人数いると化ける', 'official', 'participation', '大人数で特に盛り上がる',TRUE,  140)
ON CONFLICT (tag_id) DO NOTHING;

-- ========================================
-- ユーザー選択式タグシード（空気感・体験ベース）
-- ========================================
INSERT INTO tag_master (tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, sort_order) VALUES
  -- vibe（空気感）
  ('friends_god',        '友達とやると神',     'user_selectable', 'vibe',          '友達とやると化ける',         TRUE,  210),
  ('five_min_fun',       '5分で面白い',        'user_selectable', 'vibe',          '入りが早い',                 TRUE,  220),
  ('rule_free',          'ルール説明なしOK',   'user_selectable', 'vibe',          'ルール読まなくても遊べる',   TRUE,  230),
  ('chaos_fun',          'カオスで盛り上がる', 'user_selectable', 'vibe',          '混沌が楽しい',               TRUE,  240),
  ('silly_fun',          'ふざけると面白い',   'user_selectable', 'vibe',          'ネタプレイが映える',         TRUE,  250),
  ('time_disappear',     '気づくと時間消える', 'user_selectable', 'vibe',          '中毒性が高い',               FALSE, 260),
  -- reaction-like
  ('first_play_death',   '初見殺し',           'user_selectable', 'reaction',      '初回は分からず死にがち',     TRUE,  270),
  ('clip_worthy',        '切り抜き映え',       'user_selectable', 'reaction',      '短尺で面白さ伝わる',         TRUE,  280),
  ('betrayal',           '裏切りが起きる',     'user_selectable', 'reaction',      '人間関係が壊れる系',         TRUE,  290),
  -- caution（柔らかい言い方で）
  ('taste_split',        '好み分かれる',       'user_selectable', 'caution',       '合う合わないが分かれる',     FALSE, 310),
  ('english_some',       '英語多め',           'user_selectable', 'caution',       '英語表記がやや多い',         FALSE, 320),
  ('peace_waves',        '治安に波あり',       'user_selectable', 'caution',       '他プレイヤーの雰囲気が不定', FALSE, 330),
  ('long_session',       '長時間向き',         'user_selectable', 'caution',       '1試合が長めで注意',          FALSE, 340),
  -- participation
  ('kids_popular',       '小学生人気',         'user_selectable', 'participation', '子ども層に人気',              FALSE, 350),
  ('age_range_low',      '年齢層低めの印象',   'user_selectable', 'participation', 'プレイヤー層が若い',          FALSE, 360)
ON CONFLICT (tag_id) DO NOTHING;
