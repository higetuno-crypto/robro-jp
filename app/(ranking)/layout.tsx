import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * ランキング配下のレイアウト。
 *
 * CLAUDE.md：
 * - サイト共通ヘッダーは app/layout.tsx の SiteHeader に集約
 * - 日本語ファースト原則：「日本で人気」をデフォルト（/）に
 * - 全世界総合は /global に格下げ
 * - タブに異種を混ぜない。階層を上げて分離する
 */

const tabs: { href: string; label: string }[] = [
  { href: '/', label: '日本で人気' },
  { href: '/trending', label: '急上昇' },
  { href: '/categories', label: 'カテゴリ' },
  { href: '/new', label: '新着' },
  { href: '/global', label: '全世界' },
  // ↓ フェーズ8：ボタン別ランキング（ユーザー投票ベース）
  { href: '/recommends', label: '🔥頼むから人来て' },
  { href: '/likes', label: '❤️好き' },
  { href: '/saves', label: '⭐お気に入り' },
];

export default function RankingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* ランキング配下タブ（モバイルは横スクロール） */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-3 overflow-x-auto">
          <nav className="flex gap-4 text-[14px] whitespace-nowrap">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="py-2 px-1 hover:underline shrink-0"
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
