/**
 * ランキング表示に必要な最小限の型
 * DBの型とは意図的に分離（将来DB構造が変わっても表示側が壊れにくい）
 */

export interface RankingRowData {
  universeId: number;
  rank: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  playing: number;
  /**
   * 変動：前スナップショットからの順位差
   *  - null   : 前スナップショットにいなかった（＝NEW扱い）
   *  - 0      : 変わらず
   *  - 正の数 : 順位が上がった（例：5位→2位なら +3）
   *  - 負の数 : 順位が下がった
   */
  rankDelta: number | null;
  isJapanese: boolean;
}
