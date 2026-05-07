import Link from 'next/link';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getCategorySummaries } from '@/lib/ranking-query';

export const metadata: Metadata = {
  title: 'カテゴリ別 Roblox ゲーム一覧',
  description: 'Roblox ゲームをジャンル・カテゴリで絞り込んで発見できる一覧ページ。',
  alternates: { canonical: 'https://ro-brojp.com/categories' },
};

/**
 * カテゴリ一覧（/categories）
 *
 * DB に蓄積された genre_slug の一覧を表示。各スラグへリンク。
 * ゲーム件数の多い順。装飾は控えめ（ランキング原則に準拠）。
 */
export const revalidate = 60;

export default async function CategoriesIndexPage() {
  const supabase = createBrowserClient();
  const categories = await getCategorySummaries(supabase);

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {categories.length > 0
          ? `カテゴリ ${categories.length} 件`
          : 'カテゴリ情報はまだ収集されていません。cron が回ると表示されます。'}
      </div>
      <ul className="divide-y divide-border">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/categories/${c.slug}`}
              className="flex items-center justify-between px-3 py-3 hover:bg-muted/40"
            >
              <span className="text-[14px]">{c.label}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {c.gameCount} 本
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
