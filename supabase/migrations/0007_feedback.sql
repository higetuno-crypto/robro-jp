-- フェーズ8.5：サイトご意見・要望ボード（Fider/Canny風）
--
-- 設計方針（CLAUDE.md 拡張設計ガイドライン準拠）：
-- - #1 イベントログ型：feedback_votes は (post_id, account_id) の1行=1票
-- - #3 TEXT + CHECK：category, status はENUMではなくTEXT+CHECK
-- - #4 外部キー予約：accounts.id への FK。将来の accounts 拡張に追従
-- - #5 RLS：公開readのみ許可、書き込みは service role 経由
--
-- 認証方針：投稿・投票は ログイン必須（Supabase Auth / Google OAuth）。
-- fingerprint は多重アカウント荒らし検知・レートリミット補助の位置付け。

-- 投稿マスタ
CREATE TABLE feedback_posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 80),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  category TEXT NOT NULL CHECK (category IN ('bug','idea','content','ui','other')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','planned','in_progress','done','declined','duplicate')),
  duplicate_of BIGINT REFERENCES feedback_posts(id) ON DELETE SET NULL,
  vote_count INT NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  author_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fp_status_votes ON feedback_posts(status, vote_count DESC)
  WHERE is_hidden = FALSE;
CREATE INDEX idx_fp_created ON feedback_posts(created_at DESC)
  WHERE is_hidden = FALSE;
CREATE INDEX idx_fp_author ON feedback_posts(author_account_id);

-- 投票（1アカウント=1票）
CREATE TABLE feedback_votes (
  post_id BIGINT NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, account_id)
);
CREATE INDEX idx_fv_account ON feedback_votes(account_id, created_at DESC);
CREATE INDEX idx_fv_fp ON feedback_votes(fingerprint, created_at DESC);

-- コメント（MVP1では運営返信のみ）
CREATE TABLE feedback_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  author_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  author_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fc_post ON feedback_comments(post_id, created_at);

-- RLS：公開read、書き込みは service role
ALTER TABLE feedback_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments  ENABLE ROW LEVEL SECURITY;

-- 非表示投稿は公開しない
CREATE POLICY "public read feedback_posts" ON feedback_posts
  FOR SELECT USING (is_hidden = FALSE);

CREATE POLICY "public read feedback_votes" ON feedback_votes
  FOR SELECT USING (true);

CREATE POLICY "public read feedback_comments" ON feedback_comments
  FOR SELECT USING (true);
