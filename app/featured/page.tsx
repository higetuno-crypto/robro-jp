import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { fetchFeatured } from '@/lib/featured-query';
import { FeaturedCard } from '@/components/FeaturedCard';

export const metadata: Metadata = {
  title: 'ピックアップ',
  description: 'robro-jp 編集者が実際に遊んで良かった日本語圏 Roblox ゲームの推薦コメント付き紹介。',
  alternates: { canonical: 'https://ro-brojp.com/featured' },
};

/**
 * ピックアップページ（/featured）
 *
 * CLAUDE.md：
 *  - 編集者（Yuki）の主観で推す場所
 *  - 手動更新（Supabaseダッシュボードから直接編集）
 *  - ランキング配下タブには属さない。独立ページ
 */
export const revalidate = 300;

export default async function FeaturedPage() {
  const supabase = createBrowserClient();
  const items = await fetchFeatured(supabase, 20);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ro-brojp ピックアップ',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ro-brojp.com/game/${it.universeId}`,
      name: it.name,
    })),
  };

  return (
    <main className="max-w-3xl mx-auto px-3 py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <h1 className="text-[16px] font-semibold">ピックアップ</h1>
      <p className="text-[13px] text-muted-foreground mt-1">
        編集者が実際に遊んで良かった日本語圏Robloxゲーム。
      </p>

      {items.length === 0 ? (
        <div className="mt-6 text-[13px] text-muted-foreground">
          まだピックアップはありません。Supabaseの{' '}
          <code className="text-[12px]">featured_games</code>{' '}
          テーブルに行を追加すると即反映されます。
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <FeaturedCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </main>
  );
}
