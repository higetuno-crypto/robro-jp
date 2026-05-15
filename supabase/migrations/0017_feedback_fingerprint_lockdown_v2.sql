-- ========================================
-- 0017：feedback 系 fingerprint 列の非公開化（0016 の修正版）
--
-- 経緯：
--   0016 は `REVOKE SELECT (fingerprint列) ON feedback_* FROM anon, authenticated`
--   を実行したが、Supabase は anon / authenticated にテーブル単位の
--   GRANT SELECT を付与しており、その上に列単位 REVOKE を重ねても
--   PostgreSQL の仕様で効かない（テーブル単位 GRANT がカラム単位 REVOKE を上書き）。
--
--   実際 information_schema.column_privileges を見ると 0016 適用後も
--   anon が author_fingerprint / fingerprint に SELECT を保持していた。
--
-- 対応：
--   テーブル単位 SELECT を一旦剥がし、fingerprint を除いた安全な列のみを
--   列単位 GRANT で付け直す。INSERT/UPDATE/DELETE は RLS（policy 無し）で
--   既にブロックされているので触らない。service_role は BYPASSRLS で
--   全列フルアクセス維持。
--
--   既存アプリは SELECT * を使っておらず、必要な列名は明示しているので
--   挙動への影響は無い（lib/feedback.ts / app/admin/feedback/page.tsx 確認済）。
-- ========================================

-- ===== feedback_posts =====
REVOKE SELECT ON feedback_posts FROM anon, authenticated;
GRANT  SELECT (
  id, title, body, category, status, duplicate_of,
  vote_count, is_hidden, author_account_id,
  created_at, updated_at
) ON feedback_posts TO anon, authenticated;

-- ===== feedback_votes =====
REVOKE SELECT ON feedback_votes FROM anon, authenticated;
GRANT  SELECT (post_id, account_id, created_at)
  ON feedback_votes TO anon, authenticated;

-- ===== feedback_comments =====
REVOKE SELECT ON feedback_comments FROM anon, authenticated;
GRANT  SELECT (
  id, post_id, body, is_staff, author_account_id, created_at
) ON feedback_comments TO anon, authenticated;

-- 動作確認用：
--   -- anon は fingerprint 列に SELECT 持たないはず（0行が期待値）
--   SELECT grantee, table_name, column_name, privilege_type
--   FROM information_schema.column_privileges
--   WHERE column_name IN ('fingerprint','author_fingerprint')
--     AND grantee IN ('anon','authenticated')
--     AND privilege_type = 'SELECT';
--
--   -- 安全な列は読めるはず
--   SET ROLE anon;
--   SELECT id, title FROM feedback_posts LIMIT 1;  -- 通る
--   SELECT author_fingerprint FROM feedback_posts LIMIT 1;  -- permission denied
--   RESET ROLE;
