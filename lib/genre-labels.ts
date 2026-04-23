/**
 * Roblox の genre_slug → 日本語ラベル対応表
 *
 * Roblox 公式APIは英語ラベル（genre_l1）しか返さないため、
 * 画面表示用に日本語ラベルへ差し替える。
 * 未知のslugが来た場合はDBに入っている英語（genre_l1）をそのまま返す。
 */

const GENRE_JA: Record<string, string> = {
  action: 'アクション',
  adventure: 'アドベンチャー',
  entertainment: 'エンタメ',
  obby_and_platformer: 'オビー・足場',
  party_and_casual: 'パーティー・カジュアル',
  puzzle: 'パズル',
  roleplay_and_avatar_sim: 'ロールプレイ・なりきり',
  rpg: 'RPG',
  shooter: 'シューター',
  shopping: 'ショッピング',
  simulation: 'シミュレーション',
  social: 'ソーシャル',
  sports_and_racing: 'スポーツ・レース',
  strategy: 'ストラテジー',
  survival: 'サバイバル',
  comedy: 'コメディ',
  horror: 'ホラー',
  combat: 'バトル',
  rpgs: 'RPG',
  tycoon: 'タイクーン',
  utility_and_other: 'その他',
};

export function genreLabelJa(slug: string | null, fallback?: string | null): string {
  if (!slug) return fallback ?? '-';
  return GENRE_JA[slug] ?? fallback ?? slug;
}
