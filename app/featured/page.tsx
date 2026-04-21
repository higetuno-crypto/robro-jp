import { createBrowserClient } from '@/lib/supabase';
import { fetchFeatured } from '@/lib/featured-query';
import { FeaturedCard } from '@/components/FeaturedCard';

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

  return (
    <main className="max-w-3xl mx-auto px-3 py-4">
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
