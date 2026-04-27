-- ========================================
-- フェーズ8：game_voting_scores の REFRESH 用 RPC
--
-- マテビューは Supabase REST API から直接 REFRESH できないため、
-- SECURITY DEFINER 関数として公開する。
-- Vercel Cron から service_role で呼び出す想定。
--
-- CONCURRENTLY オプションは UNIQUE INDEX があれば使える。
-- 0008 で idx_gvs_universe を UNIQUE で作成済みなので有効。
-- ========================================

CREATE OR REPLACE FUNCTION public.refresh_game_voting_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY game_voting_scores;
END;
$$;

-- service_role と authenticated の両方に EXECUTE を付与
-- （Cron は service_role 経由だが、将来的に内部APIから呼ぶ可能性も含めて）
GRANT EXECUTE ON FUNCTION public.refresh_game_voting_scores() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_game_voting_scores() TO authenticated;
