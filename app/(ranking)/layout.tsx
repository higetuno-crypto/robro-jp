import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * ランキング配下のレイアウト。
 *
 * CLAUDE.md：
 * - サイト共通ヘッダーは app/layout.tsx の SiteHeader に集約
 * - ランキング配下タブ：[総合] [急上昇] [日本語]
 * - タブに異種を混ぜない。階層を上げて分離する
 */

const tabs: { href: string; label: string }[] = [
  { href: '/', label: '総合' },
  { href: '/trending', label: '急上昇' },
  { href: '/japanese', label: '日本語' },
];

export default function RankingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* ランキング配下タブ */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-3">
          <nav className="flex gap-4 text-[14px]">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="py-2 px-1 hover:underline"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-3xl mx-auto">{children}</main>
    </>
  );
}
