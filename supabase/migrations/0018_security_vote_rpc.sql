-- ========================================
-- 0018：公開権限の締め直し + 投票処理の原子化
--
-- 対応:
--   1. creators の verification_code / verification_expires_at を公開 SELECT から外す。
--   2. refresh_game_voting_scores() を service_role 専用に戻す。
--   3. game_button_vote_logs へのクライアント直 INSERT を閉じ、
--      service_role 専用 RPC で重複判定 + ログ INSERT + 集計更新を原子化する。
--   4. feedback_votes の公開読み取りをやめ、本人の投票済み判定だけ読めるようにする。
--   5. feedback 投票トグルも service_role 専用 RPC で原子化する。
-- ========================================

-- ===== creators: verification code を公開しない =====
REVOKE SELECT ON creators FROM anon, authenticated;
GRANT SELECT (
  id, account_id, display_name, self_introduction, avatar_url,
  social_links, roblox_profile_url, roblox_user_id,
  verified_at, is_verified, created_at, updated_at
) ON creators TO anon, authenticated;

-- ===== refresh RPC: cron(service_role) 専用 =====
REVOKE EXECUTE ON FUNCTION public.refresh_game_voting_scores() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_game_voting_scores() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_game_voting_scores() TO service_role;

-- ===== button votes: direct INSERT を禁止し、RPC に寄せる =====
DROP POLICY IF EXISTS "user can insert own vote logs" ON game_button_vote_logs;

CREATE OR REPLACE FUNCTION public.cast_button_vote_atomic(
  p_universe_id BIGINT,
  p_button_type TEXT,
  p_account_id UUID,
  p_fingerprint TEXT,
  p_vote_value SMALLINT
)
RETURNS TABLE (
  vote_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ;
  v_last SMALLINT;
  v_count INT;
BEGIN
  IF p_universe_id IS NULL OR p_universe_id <= 0 THEN
    RAISE EXCEPTION 'invalid_universe_id';
  END IF;
  IF p_button_type NOT IN ('like', 'save', 'recommend') THEN
    RAISE EXCEPTION 'invalid_button_type';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id_required';
  END IF;
  IF p_vote_value NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid_vote_value';
  END IF;

  -- 同一ユーザー・ゲーム・ボタンの同時押下を直列化する。
  PERFORM pg_advisory_xact_lock(
    hashtext(p_account_id::text || ':' || p_universe_id::text || ':' || p_button_type)
  );

  v_since := NOW() - INTERVAL '24 hours';

  SELECT gbvl.vote_value
    INTO v_last
  FROM game_button_vote_logs gbvl
  WHERE gbvl.universe_id = p_universe_id
    AND gbvl.button_type = p_button_type
    AND gbvl.account_id = p_account_id
    AND gbvl.created_at >= v_since
  ORDER BY gbvl.created_at DESC, gbvl.id DESC
  LIMIT 1;

  IF p_vote_value = 1 AND v_last = 1 THEN
    RAISE EXCEPTION 'already_voted';
  END IF;
  IF p_vote_value = -1 AND COALESCE(v_last, 0) <> 1 THEN
    RAISE EXCEPTION 'no_active_vote';
  END IF;

  INSERT INTO game_button_vote_logs (
    universe_id, button_type, account_id, fingerprint, vote_value
  )
  VALUES (
    p_universe_id, p_button_type, p_account_id, COALESCE(p_fingerprint, ''), p_vote_value
  );

  IF p_button_type = 'save' THEN
    IF p_vote_value = 1 THEN
      INSERT INTO user_savings (account_id, universe_id)
      VALUES (p_account_id, p_universe_id)
      ON CONFLICT (account_id, universe_id) DO NOTHING;
    ELSE
      DELETE FROM user_savings
      WHERE account_id = p_account_id
        AND universe_id = p_universe_id;
    END IF;
  END IF;

  SELECT gbv.vote_count
    INTO v_count
  FROM game_button_votes gbv
  WHERE gbv.universe_id = p_universe_id
    AND gbv.button_type = p_button_type;

  RETURN QUERY SELECT COALESCE(v_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cast_button_vote_atomic(BIGINT, TEXT, UUID, TEXT, SMALLINT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cast_button_vote_atomic(BIGINT, TEXT, UUID, TEXT, SMALLINT) TO service_role;

-- ===== feedback_votes: 投票者一覧を公開しない =====
DROP POLICY IF EXISTS "public read feedback_votes" ON feedback_votes;
REVOKE SELECT ON feedback_votes FROM anon, authenticated;
GRANT SELECT (post_id, account_id, created_at) ON feedback_votes TO authenticated;

DROP POLICY IF EXISTS "user can read own feedback votes" ON feedback_votes;
CREATE POLICY "user can read own feedback votes"
  ON feedback_votes FOR SELECT
  USING (auth.uid() = account_id);

CREATE OR REPLACE FUNCTION public.toggle_feedback_vote_atomic(
  p_post_id BIGINT,
  p_account_id UUID,
  p_fingerprint TEXT
)
RETURNS TABLE (
  voted BOOLEAN,
  vote_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
  v_count INT;
BEGIN
  IF p_post_id IS NULL OR p_post_id <= 0 THEN
    RAISE EXCEPTION 'invalid_post_id';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('feedback:' || p_post_id::text || ':' || p_account_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM feedback_posts
    WHERE id = p_post_id AND is_hidden = FALSE
  ) THEN
    RAISE EXCEPTION 'post_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM feedback_votes
    WHERE post_id = p_post_id AND account_id = p_account_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM feedback_votes
    WHERE post_id = p_post_id AND account_id = p_account_id;
  ELSE
    INSERT INTO feedback_votes (post_id, account_id, fingerprint)
    VALUES (p_post_id, p_account_id, COALESCE(p_fingerprint, ''));
  END IF;

  SELECT COUNT(*)::INT
    INTO v_count
  FROM feedback_votes
  WHERE post_id = p_post_id;

  UPDATE feedback_posts
  SET vote_count = v_count,
      updated_at = NOW()
  WHERE id = p_post_id;

  RETURN QUERY SELECT NOT v_exists, v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_feedback_vote_atomic(BIGINT, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.toggle_feedback_vote_atomic(BIGINT, UUID, TEXT) TO service_role;
