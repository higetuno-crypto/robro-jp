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
  /**
   * 現在のCCU（最新スナップショットの playing）。
   * null = スナップショット未取得（ランキング外の手動追加ゲーム等）＝CCU不明。
   * 既存のランキングは常に数値を渡すので後方互換。
   */
  playing: number | null;
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
