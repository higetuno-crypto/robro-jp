-- 攻略Tips「型（呼び水の問いかけ）」：ゲーム別・カテゴリ別の問いかけをDBに持つ
-- 仕様：higesakusei/新しい方向性/攻略Tips-MVP設計.md §5.2（AIで"型"を用意） / §10 MVP-1（T-SEED）
--
-- 方針：
--  - AI が作るのは「問いかけ（質問）」まで。攻略本文（呼び水）はユーザー/Yuki が書く（§6 原則：
--    AI は実プレイしていないため攻略本文を書くと不正確）。ここに入るのは "質問" のみ。
--  - 空ページ感を消し、人間が埋める対象を明示して UGC 投稿のハードルを下げる（コールドスタート対策）。
--  - 公開読み取りは Tips 本体と同じく service client（サーバ専用）経由。anon 公開ポリシーは張らない。
--
-- 反映：本番DBへローカルから直接 push できないため、Yuki が Supabase（SQL Editor or `supabase db push`）で適用する。

-- =========================================================
-- テーブル
-- =========================================================
CREATE TABLE game_strategy_tip_prompts (
  prompt_id   BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('early','earn','boss','trick','glossary','controls','other')),
  prompt_ja   TEXT NOT NULL CHECK (char_length(prompt_ja) BETWEEN 4 AND 60),  -- 問いかけ（質問）。本文ではない
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 同一ゲーム×カテゴリ×文言の重複を禁止（idempotent seed のため）
  UNIQUE (universe_id, category, prompt_ja)
);
CREATE INDEX idx_gstp_universe_active ON game_strategy_tip_prompts(universe_id, is_active, sort_order);

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE game_strategy_tip_prompts ENABLE ROW LEVEL SECURITY;
-- 公開ポリシーは張らない（= anon/authenticated からは到達不能）。
-- 表示はサーバの service client 経由（lib/strategy-tips.ts の fetchTipPrompts）で行う。
-- 将来 anon 直読みが必要になったら `is_active = TRUE` の SELECT ポリシーを足す。

-- =========================================================
-- SEED：種まき4ゲームの問いかけ（§5.1 の GSC 実績ゲーム）
--   - 入っているのは "質問" のみ。攻略本文は一切書かない（§6 原則）。
--   - idempotent：ゲームが games に存在する時のみ／重複文言は ON CONFLICT DO NOTHING。
-- =========================================================
INSERT INTO game_strategy_tip_prompts (universe_id, category, prompt_ja, sort_order)
SELECT v.universe_id, v.category, v.prompt_ja, v.sort_order
FROM (VALUES
  -- 9348272796：ゾンビ系サバイバル（「ゾンビアリーナで生き残る」）
  (9348272796::BIGINT, 'early',    '序盤、まず何をすればいい？',        1),
  (9348272796::BIGINT, 'controls', '操作で最初に覚えることは？',        2),
  (9348272796::BIGINT, 'boss',     'ゾンビの群れはどう切り抜ける？',    3),
  (9348272796::BIGINT, 'earn',     'お金やポイントの稼ぎ方は？',        4),
  (9348272796::BIGINT, 'trick',    '知っておくと得な小技は？',          5),

  -- 8791358380：（「ボボを盗まないで」）
  (8791358380::BIGINT, 'early',    '始めたら最初に何をする？',          1),
  (8791358380::BIGINT, 'controls', '基本の立ち回り・操作のコツは？',    2),
  (8791358380::BIGINT, 'trick',    '覚えておくと便利なテクは？',        3),
  (8791358380::BIGINT, 'glossary', 'ゲーム内の用語をやさしく言うと？',  4),
  (8791358380::BIGINT, 'other',    '初見が戸惑いやすいところは？',      5),

  -- 9091133975：キャッチ系（「キャッチして手懐ける」）
  (9091133975::BIGINT, 'early',    '序盤の進め方は？',                  1),
  (9091133975::BIGINT, 'earn',     '効率よく集める・育てるコツは？',    2),
  (9091133975::BIGINT, 'trick',    'キャッチや手懐けの小技は？',        3),
  (9091133975::BIGINT, 'glossary', 'よく出る用語の意味は？',            4),
  (9091133975::BIGINT, 'controls', '操作で迷いやすいところは？',        5),

  -- 7395930870：売る/経営系（「レモンを売る」）
  (7395930870::BIGINT, 'early',    '最初の数分で何をすると良い？',      1),
  (7395930870::BIGINT, 'earn',     '効率よく稼ぐコツは？',              2),
  (7395930870::BIGINT, 'trick',    '値段や仕入れで使える小技は？',      3),
  (7395930870::BIGINT, 'controls', '操作・UIで迷う点は？',              4)
) AS v(universe_id, category, prompt_ja, sort_order)
WHERE EXISTS (SELECT 1 FROM games g WHERE g.universe_id = v.universe_id)
ON CONFLICT (universe_id, category, prompt_ja) DO NOTHING;
