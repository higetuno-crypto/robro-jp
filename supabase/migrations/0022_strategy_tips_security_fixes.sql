-- 0020/0021 のセキュリティ修正（Codex レビュー 2026-06-09 指摘 P1×2）
--
-- (1) [P1] 公開 read で fingerprint / account_id / report_count が漏れる
--     → base table の公開 SELECT ポリシーを撤去し、安全な公開ビューだけを露出する
-- (2) [P1] 同一 fingerprint が同一 Tip を5回通報して単独で自動 hide できる
--     → 通報を (tip_id, fingerprint) で一意化し、distinct reporter のみ計上する

-- =========================================================
-- (1) 公開読み取りを安全な列だけに限定
-- =========================================================
-- anon が base table を直接読めないようにする（published 行でも全列が見えていた）
DROP POLICY IF EXISTS "public read published strategy tips" ON game_strategy_tips;

-- 公開ビュー：公開してよい列のみ＋published のみ。
-- security_invoker を付けない（= ビュー所有者権限で base を読む）ことで、
-- このビューが唯一の公開面となり、fingerprint / account_id / status / report_count は露出しない。
CREATE VIEW strategy_tips_public AS
  SELECT
    tip_id,
    universe_id,
    category,
    body_ja,
    helpful_count,
    (account_id IS NOT NULL) AS is_member_author,  -- UUID は出さず真偽だけ
    created_at
  FROM game_strategy_tips
  WHERE status = 'published';

REVOKE ALL ON strategy_tips_public FROM PUBLIC;
GRANT SELECT ON strategy_tips_public TO anon, authenticated;

-- =========================================================
-- (2) 通報を distinct reporter で数える
-- =========================================================
ALTER TABLE game_strategy_tip_reports
  ADD CONSTRAINT uq_gstr_tip_fp UNIQUE (tip_id, fingerprint);

CREATE OR REPLACE FUNCTION report_strategy_tip(
  p_tip_id      BIGINT,
  p_reason      TEXT,
  p_detail      TEXT,
  p_fingerprint TEXT
) RETURNS TABLE (new_report_count INT, auto_hidden BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows   INT;
  v_count  INT;
  v_status TEXT;
  v_hidden BOOLEAN := FALSE;
  c_threshold CONSTANT INT := 5;  -- distinct reporter 数のしきい値
BEGIN
  -- 同一 fingerprint × 同一 Tip の重複通報は無視（自作自演での自動 hide を防ぐ）
  INSERT INTO game_strategy_tip_reports (tip_id, reason, detail, fingerprint)
  VALUES (p_tip_id, p_reason, p_detail, p_fingerprint)
  ON CONFLICT (tip_id, fingerprint) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- 既に同一 fingerprint から通報済み。件数据え置きで現状を返す
    SELECT report_count, status INTO v_count, v_status
      FROM game_strategy_tips WHERE tip_id = p_tip_id;
    IF v_count IS NULL THEN
      RAISE EXCEPTION 'tip not found';
    END IF;
    RETURN QUERY SELECT v_count, FALSE;
    RETURN;
  END IF;

  UPDATE game_strategy_tips
    SET report_count = report_count + 1, updated_at = NOW()
    WHERE tip_id = p_tip_id
    RETURNING report_count, status INTO v_count, v_status;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'tip not found';
  END IF;

  IF v_count >= c_threshold AND v_status = 'published' THEN
    UPDATE game_strategy_tips SET status = 'hidden', updated_at = NOW() WHERE tip_id = p_tip_id;
    INSERT INTO game_strategy_tip_logs (tip_id, event, fingerprint)
    VALUES (p_tip_id, 'hide', 'system:auto_report_threshold');
    v_hidden := TRUE;
  END IF;

  RETURN QUERY SELECT v_count, v_hidden;
END;
$$;

REVOKE EXECUTE ON FUNCTION report_strategy_tip(BIGINT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION report_strategy_tip(BIGINT,TEXT,TEXT,TEXT) TO service_role;
