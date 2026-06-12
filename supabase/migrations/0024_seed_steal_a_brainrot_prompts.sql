-- 攻略Tips 種まき追加：本家「Steal a Brainrot」(universe_id 7709344486) の問いかけ
--
-- 背景：robro-jp の games 名前検索で brainrot 系が60本超ヒット＝ジャンルが爆発している。
--   本家 Steal a Brainrot（creator: BRAZILIAN SPYDER）は現在CCU 約128k・累計 69.8B visits で
--   この種まきセットの最大。既存 seed の 8791358380「Don't Steal the Bobo」は同ジャンルのクローン
--   （CCU 約5k）で本家ではないため、震源である本家を追加する。
--
-- ⚠️ universe_id の確定：Web 上で見かける 109983668079237 は universe_id ではない
--   （Roblox games API が当該IDを返さない＝place_id 等）。Roblox 公式API（games/v1）と
--   robro-jp の games テーブルの両方で確認した正しい universe_id は 7709344486。
--
-- 前提：0023 の game_strategy_tip_prompts（適用済み）。本ファイルは DATA seed のみ（DDLなし）。
-- 原則：入っているのは "質問" のみ。攻略本文は書かない（§6）。idempotent（ゲーム存在時のみ／重複は無視）。
-- 反映：本番DBへローカルから直接適用できないため、Yuki が Supabase（SQL Editor or db push）で適用する。

INSERT INTO game_strategy_tip_prompts (universe_id, category, prompt_ja, sort_order)
SELECT v.universe_id, v.category, v.prompt_ja, v.sort_order
FROM (VALUES
  (7709344486::BIGINT, 'early',    '最初に何を買う・どう始めればいい？',                1),
  (7709344486::BIGINT, 'earn',     '効率よくお金を稼ぐコツは？',                        2),
  (7709344486::BIGINT, 'trick',    'ブレインロットを盗まれにくくするには？',            3),
  (7709344486::BIGINT, 'trick',    'うまく盗む・逃げ切るコツは？',                      4),
  (7709344486::BIGINT, 'glossary', 'レア度や用語（シークレット等）をやさしく言うと？',  5),
  (7709344486::BIGINT, 'controls', '操作・基本の立ち回りで迷う点は？',                  6)
) AS v(universe_id, category, prompt_ja, sort_order)
WHERE EXISTS (SELECT 1 FROM games g WHERE g.universe_id = v.universe_id)
ON CONFLICT (universe_id, category, prompt_ja) DO NOTHING;
