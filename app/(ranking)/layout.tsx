import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * ランキング配下のレイアウト。
 *
 * CLAUDE.md：
 * - ヘッダー：[ランキング] [ピックアップ] [宣伝（フェーズ6以降）]
 * - ランキング配下タブ：[総合] [急上昇] [日本語]
 * - タブに異種を混ぜない。階層を上げて分離する
 *
 * フェーズ2時点では「急上昇」「日本語」は未実装だがタブだけ先に置く。
 * フェーズ3で実装する。
 */

const tabs: { href: string; label: string }[] = [
  { href: '/', label: '総合' },
  { href: '/trending', label: '急上昇' },
  { href: '/japanese', label: '日本語' },
];

export default function RankingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* 全体ヘッダー（ランキング/ピックアップ）。ピックアップはフェーズ5で実装 */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-4">
          <Link href="/" className="text-[14px] font-semibold">
            Roblox Japan Ranking
          </Link>
          <nav className="ml-auto flex gap-3 text-[14px]">
            <Link href="/" className="hover:underline">
              ランキング
            </Link>
            <Link
              href="/featured"
              className="text-muted-foreground hover:underline"
            >
              ピックアップ
            </Link>
          </nav>
        </div>
      </header>

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
    </div>
  );
}
