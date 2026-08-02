/**
 * AdSense 設定（フェーズ12 / CLAUDE.md「E. AdSense 広告枠」）
 *
 * 方針：
 *  - 運営費は AdSense のみで賄う。決済プロバイダは導入しない（v4方針）
 *  - 各広告枠に「広告」ラベルを明示（ステマ規制 2023-10 順守）
 *  - ランキング行間・ファーストビューには入れない（UI設計原則）
 *  - 18歳未満へのパーソナライズ広告を出さない
 *    （運営コンプライアンス章 / Roblox 2026-04-30 Privacy 改定に整合）
 *
 * スロットIDは AdSense 管理画面で広告ユニットを作成すると発行される値。
 * 環境変数が未設定の枠は **何も描画しない** ため、IDが揃う前にデプロイしても安全。
 *
 * 料金・閾値のハードコード禁止（拡張ガイドライン#2）に倣い、
 * 可変値はすべて環境変数に逃がしている。
 */

/** AdSense パブリッシャーID。既存の layout.tsx 直書き値を既定値として引き継ぐ */
export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? 'ca-pub-5811589837476935';

/**
 * 年齢別の広告取り扱い（AdSense: tag for age treatment）
 *
 *   '1' = 児童向け（13歳未満）扱い
 *   '2' = ティーン向け（18歳未満）扱い
 *   '0' = 指定なし（パーソナライズ広告が有効）← 現在の設定
 *
 * 2026-08 Yuki 判断で '0'（指定なし）を採用。
 * パーソナライズ無効は RPM を大きく下げる（概ね50〜80%減）ため、収益を優先した。
 *
 * 留意点：
 *  - Google が独自に本サイトを child-directed と判定した場合は、この設定に関わらず
 *    Google 側で制限が適用される
 *  - 方針を戻す場合は環境変数 NEXT_PUBLIC_ADSENSE_AGE_TREATMENT を '2' にするだけでよい
 */
export const ADSENSE_AGE_TREATMENT =
  process.env.NEXT_PUBLIC_ADSENSE_AGE_TREATMENT ?? '0';

/** 広告表示そのものの機能フラグ（拡張ガイドライン#6：段階リリース） */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_ADS === 'true';

/**
 * 枠ごとのスロットID。未設定の枠は描画されない。
 * 配置は CLAUDE.md フェーズ12 の既定：
 *   footer     … 全ページ共通・フッター直上
 *   gameDetail … ゲーム詳細の「概要」と「CCUグラフ」の間
 */
export const AD_SLOTS = {
  footer: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER,
  gameDetail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAME_DETAIL,
} as const;
