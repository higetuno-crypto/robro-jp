import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking, getCategorySummaries } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

/**
 * カテゴリ別ランキング（/categories/[slug]）
 *
 * games.genre_slug = slug に絞って playing 降順。
 * 同じ RankingRow を使い回し、見た目は全ランキングページで統一。
 */
export const revalidate = 300;

export default async function CategoryRankingPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const supabase = createBrowserClient();
  const [{ rows, capturedAt }, categories] = await Promise.all([
    getRanking(supabase, 'category', 100, { categorySlug: slug }),
    getCategorySummaries(supabase),
  ]);

  const current = categories.find((c) => c.slug === slug);
  const label = current?.label ?? slug;

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground flex items-center gap-2">
        <Link href="/categories" className="hover:underline">
          カテゴリ
        </Link>
        <span>/</span>
        <span className="text-foreground">{label}</span>
      </div>
      <div className="px-3 pb-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ ${label} TOP${rows.length}`
          : `${label} のゲームはまだ収集されていません。`}
      </div>
      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
