/**
 * 日本語ゲーム判定（ルールベース）
 *
 * 目的：name / description から「日本語圏向けのゲームらしさ」をスコア化する。
 * CLAUDE.md のビジョン「日本語ファースト」の実装層。
 *
 * 完璧を目指さない：
 * - しきい値で二値判定（is_japanese: boolean）＋ スコア（japanese_score: 0〜1）
 * - 将来 ML判定に差し替えやすいよう、この関数の入出力だけに依存させる
 */

// ひらがな・カタカナ
const KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FF]/g;
// 漢字（CJK統合漢字のみ。中国語と被るが、スコアは低めに扱う）
const KANJI_REGEX = /[\u4E00-\u9FFF]/g;
// 全角記号「」『』・ー等（日本語テキスト特有の記号）
const JP_PUNCT_REGEX = /[\u3000-\u303F\uFF00-\uFFEF]/g;

/**
 * 日本語頻出の手がかり語（ジャンル・タイトルでよく使われる短い語）
 * 部分一致で使う。大文字小文字を無視。
 */
const JP_KEYWORDS = [
  'シミュレーター',
  'シミュレータ',
  '学園',
  '日本',
  'にほん',
  'ニッポン',
  'おに',
  '鬼ごっこ',
  'タイクーン',
  '物語',
  '日常',
  'バトル',
  'おとぎ',
];

export interface JapaneseJudgement {
  isJapanese: boolean;
  score: number; // 0〜1
}

/**
 * スコア算出：
 * - かな が 1文字でもあれば強いシグナル（+0.6）
 * - 全角記号 がある場合 +0.1
 * - キーワード 部分一致 ごとに +0.15（上限+0.3）
 * - 漢字だけしか無い場合は弱いシグナル（+0.2）※中国語と区別しづらいため
 *
 * しきい値 0.5 以上で is_japanese = true
 *
 * nameJa（Roblox の ja-jp ロケール名）も判定対象に含める。
 * これはクリエイターが意図的に日本語タイトルを設定した時だけ日本語で返るため、
 * 「英語の正式名・英語の説明だが日本語名を用意している日本人制作ゲーム」を
 * 取りこぼさないための強いシグナル（英語ゲームの ja-jp 名は英語のまま返る）。
 */
export function detectJapanese(
  name: string | null | undefined,
  description: string | null | undefined,
  nameJa?: string | null | undefined
): JapaneseJudgement {
  // name_ja が name と同一（＝日本語ロケール名が無い）の場合は重複させない
  const jaPart = nameJa && nameJa !== name ? ` ${nameJa}` : '';
  const text = `${name ?? ''} ${description ?? ''}${jaPart}`;
  if (!text.trim()) return { isJapanese: false, score: 0 };

  const kanaCount = (text.match(KANA_REGEX) ?? []).length;
  const kanjiCount = (text.match(KANJI_REGEX) ?? []).length;
  const punctCount = (text.match(JP_PUNCT_REGEX) ?? []).length;

  let score = 0;
  if (kanaCount > 0) score += 0.6;
  if (punctCount > 0) score += 0.1;
  if (kanaCount === 0 && kanjiCount > 0) score += 0.2;

  // キーワード部分一致
  let keywordHits = 0;
  for (const kw of JP_KEYWORDS) {
    if (text.includes(kw)) keywordHits++;
  }
  score += Math.min(0.3, keywordHits * 0.15);

  // クリップ
  score = Math.min(1, Math.max(0, score));

  return { isJapanese: score >= 0.5, score: Number(score.toFixed(3)) };
}
