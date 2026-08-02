'use client';

import { usePathname } from 'next/navigation';
import { AdSlot } from './AdSlot';
import { ADS_ENABLED, AD_SLOTS } from '@/lib/ads';

/**
 * フッター直上の広告枠（CLAUDE.md フェーズ12 の既定配置）。
 *
 * 広告を出してよいのは「コンテンツのあるページ」だけなので **許可リスト方式** にする。
 *
 * 除外する理由：
 *  - /admin/*    運営者本人が毎日開くため、自己インプレッション（無効なトラフィック）になる。
 *                これは AdSense のアカウント停止事由の筆頭であり、収益より優先して避ける
 *  - 404 / error AdSense は実質的なコンテンツの無いページへの広告掲載を禁じている
 *  - /login 等   同上
 *
 * 許可リストに無いパス（＝未知のURLで 404 が出るパス）は自動的に除外される。
 * root layout に直接 AdSlot を置くとこれらを全て素通ししてしまうため、
 * 判定をこのコンポーネントに閉じ込めている。
 */
const CONTENT_PREFIXES = [
  '/game/',
  '/tags',
  '/stream',
  '/featured',
  '/creators',
  '/categories',
  '/trending',
  '/new',
  '/global',
  '/made-in-japan',
  '/likes',
  '/saves',
  '/recommends',
  '/search',
  '/guide',
];

export function FooterAd() {
  const pathname = usePathname();

  // 枠が無効な時はラッパ div ごと描画しない（空の余白が残るのを防ぐ）
  if (!ADS_ENABLED || !AD_SLOTS.footer) return null;

  const isContentPage =
    pathname === '/' ||
    CONTENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (!isContentPage) return null;

  return (
    <div className="max-w-3xl mx-auto px-3 mt-10">
      <AdSlot slot={AD_SLOTS.footer} minHeight={100} />
    </div>
  );
}
