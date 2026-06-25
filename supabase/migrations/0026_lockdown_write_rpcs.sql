-- ========================================
-- 0026：書き込み系 SECURITY DEFINER 関数の EXECUTE を本番で締め直す
--
-- 背景（2026-06-25 Supabase Security Advisor + 実測で発覚）：
--   0015 / 0018 / 0020 / 0022 で各書き込み RPC に
--     REVOKE EXECUTE ... FROM PUBLIC; GRANT ... TO service_role;
--   を書いていたが、本番 DB に「関数本体だけ適用されて REVOKE/GRANT が
--   適用されていない」状態だった。
--
--   実測（anon キーで直接 .rpc()）：
--     post_strategy_tip / vote_strategy_tip / report_strategy_tip
--     / cast_tag_vote / toggle_feedback_vote_atomic
--       → いずれも anon が「関数本体まで実行できる」状態だった（P0001 等が返る）
--     cast_button_vote_atomic のみ 42501 permission denied（正しくロック済み）
--
--   実害：
--     - anon が post_strategy_tip を直接叩くと、API 層（禁止語チェック・
--       レート制限・ゲーム存在確認）を全部迂回して即時公開 Tips を投稿できる。
--     - report_strategy_tip は fingerprint を引数で自由指定できるため、
--       一人で別 fingerprint を 5 個投げて任意 Tips を自動 hidden にできる（検閲攻撃）。
--     - toggle_feedback_vote_atomic / cast_tag_vote は account_id を引数で
--       受け取るため、他人になりすました投票が可能。
--
-- 方針（重要）：
--   外部レビューでは「ログイン必須化（auth.uid）」が提案されたが、それは誤り。
--   このサイトの攻略Tips/タグ投票は「匿名投稿可・全書き込みはサーバ(service_role)経由」
--   が設計（0020 冒頭参照）。正しい対処は当初設計どおり service_role 限定に戻すこと。
--   関数のロジックは一切変更しない（grant だけを直す）。
--
--   アプリ側は全書き込みルートが createServiceClient()（service_role）経由で
--   RPC を呼ぶことを確認済み（lib/strategy-tips.ts / lib/tags.ts / lib/feedback.ts
--   / lib/votes.ts を叩く app/api/* は全て createServiceClient）。
--   anon / authenticated から直接 .rpc() する箇所は無いので、この締め直しで
--   既存機能は壊れない。
--
-- search_path（Function Search Path Mutable 警告）は本 migration では対象外。
--   投票の穴を塞ぐのが最優先。search_path 対策は別途。
-- ========================================

-- 1) public スキーマの全 SECURITY DEFINER 関数から、PUBLIC / anon / authenticated の
--    EXECUTE を剥奪する。トリガ関数（handle_new_user 等）も対象になるが、トリガは
--    EXECUTE 権限と無関係に発火するため、剥奪しても動作は壊れない（advisor 警告も解消）。
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = TRUE          -- SECURITY DEFINER のみ
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      r.sig
    );
  END LOOP;
END $$;

-- 2) サーバ(service_role)経由でのみ呼ぶ書き込み／集計 RPC に EXECUTE を grant し直す。
--    （トリガ関数には grant しない＝誰からも直接呼べない状態が正しい）
--    注：本番に未適用の migration の関数（例：0025 の kpi_k1）はまだ存在しないため、
--        to_regprocedure() で存在チェックしてから grant する（42883 を避ける）。
--        未適用 migration は後で適用される際に自前で grant するので問題ない。
DO $$
DECLARE
  fn TEXT;
  sigs TEXT[] := ARRAY[
    'public.cast_tag_vote(bigint, text, uuid, text)',
    'public.post_strategy_tip(bigint, text, text, uuid, text, inet, text)',
    'public.vote_strategy_tip(bigint, uuid, text)',
    'public.report_strategy_tip(bigint, text, text, text)',
    'public.toggle_feedback_vote_atomic(bigint, uuid, text)',
    'public.cast_button_vote_atomic(bigint, text, uuid, text, smallint)',
    'public.refresh_game_voting_scores()',
    'public.kpi_k1_discovery_lead_time(timestamptz, timestamptz)'
  ];
BEGIN
  FOREACH fn IN ARRAY sigs LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    ELSE
      RAISE NOTICE 'skip grant (not found): %', fn;
    END IF;
  END LOOP;
END $$;

-- 3) 検証（Supabase SQL Editor で手動確認用）：
--    anon ロールで各書き込み RPC が permission denied(42501) になることを確認する。
--      SET ROLE anon;
--      SELECT public.vote_strategy_tip(-1, NULL, 'probe');   -- ERROR: permission denied for function
--      RESET ROLE;
--    あるいはローカルから anon キーで .rpc() を叩いて 42501 を確認（下記コマンド）。
