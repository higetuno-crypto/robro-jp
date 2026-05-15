-- ========================================
-- 0016：feedback 系テーブルの fingerprint 列を anon / authenticated から非公開化
--
-- 経緯：
--   0007_feedback.sql で feedback_posts / feedback_votes / feedback_comments に
--   RLS + 公開 SELECT ポリシーを敷いたが、PostgREST 経由で
--     GET /rest/v1/feedback_posts?select=author_fingerprint
--   のように指定すると fingerprint 列がそのまま読めてしまう。
--   fingerprint は makeFingerprint(IP, UA) の SHA-256 ハッシュであり、
--   同じハッシュが game_tag_vote_logs や game_button_vote_logs にも入るため、
--   feedback から抜き出した fingerprint で投票履歴をクロス参照される懸念がある。
--
-- 対応：
--   列レベル GRANT/REVOKE で anon / authenticated からの SELECT 権限を fingerprint
--   列に限って剥奪する。service_role は引き続き読み書き可能（バックアップ・調査用）。
--   既存のクエリは fingerprint 列を select していないので動作に影響しない。
--
-- 参考：PostgreSQL の column-level privileges は RLS とは独立。
--       BYPASSRLS でも column privilege は適用される（= service_role には付与済）。
-- ========================================

REVOKE SELECT (author_fingerprint) ON feedback_posts    FROM anon, authenticated;
REVOKE SELECT (fingerprint)        ON feedback_votes    FROM anon, authenticated;
REVOKE SELECT (author_fingerprint) ON feedback_comments FROM anon, authenticated;

-- 動作確認用：
--   -- anon キーで叩くと permission denied for column が返るはず
--   SET ROLE anon;
--   SELECT author_fingerprint FROM feedback_posts LIMIT 1;
--   RESET ROLE;
--
--   -- service_role なら通る
--   SET ROLE service_role;
--   SELECT author_fingerprint FROM feedback_posts LIMIT 1;
--   RESET ROLE;
