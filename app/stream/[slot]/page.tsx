import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  fetchSlotBySlug,
  fetchGamesForSlot,
  englishBarrierLabel,
} from '@/lib/streaming';
import { StreamBadgeList } from '@/components/stream/StreamBadge';

/**
 * /stream/[slot] — 用途別ゲーム一覧。
 * 並び順：confidence_score DESC, editorial_score_stream DESC, total_vote_count DESC
 */
export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: { slot: string };
}) {
  const supabase = createBrowserClient();
  const slot = await fetchSlotBySlug(supabase, params.slot).catch(() => null);
  const name = slot?.displayName ?? params.slot;
  const desc = slot?.description ?? `${name} に向く Roblox ゲーム一覧。配信ネタ選びに。`;
  return {
    title: `配信向け：${name}`,
    description: desc,
    alternates: { canonical: `https://ro-brojp.com/stream/${params.slot}` },
    openGraph: {
      title: `配信向け：${name} | ro-brojp`,
      description: desc,
      url: `https://ro-brojp.com/stream/${params.slot}`,
      type: 'website',
      locale: 'ja_JP',
    },
  };
}

export default async function StreamSlotPage({
  params,
}: {
  params: { slot: string };
}) {
  const supabase = createBrowserClient();
  const slot = await fetchSlotBySlug(supabase, params.slot);
  if (!slot) notFound();

  const games = await fetchGamesForSlot(supabase, params.slot, 50);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `配信向け：${slot.displayName}`,
    description: slot.description,
    numberOfItems: games.length,
    itemListElement: games.slice(0, 50).map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ro-brojp.com/game/${g.universeId}`,
      name: g.name,
    })),
  };

  return (
    <section className="max-w-3xl mx-auto px-3 py-3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <div className="text-[13px] text-muted-foreground mb-2">
        <Link href="/stream" className="hover:underline">
          配信ネタ
        </Link>
        <span className="mx-1">/</span>
        <span>{slot.displayName}</span>
      </div>

      <header className="mb-4">
        <h1 className="text-[18px] font-semibold">{slot.displayName}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{slot.description}</p>
      </header>

      {games.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          該当するゲームがまだありません。タグ投票が集まると並び始めます。
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {games.map((g) => (
            <li key={g.universeId} className="py-2">
              <Link
                href={`/game/${g.universeId}`}
                className="flex gap-3 hover:bg-muted/30"
              >
                <div className="w-[60px] h-[60px] bg-muted overflow-hidden shrink-0">
                  {g.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium leading-tight truncate">
                    {g.name}
                  </div>
                  {g.shortPitchJa && (
                    <div className="text-[12px] text-muted-foreground truncate mt-0.5">
                      {g.shortPitchJa}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <StreamBadgeList tagIds={g.badges} />
                  </div>
                </div>
                {g.englishBarrier && (
                  <div className="shrink-0 text-[11px] text-muted-foreground self-start">
                    {englishBarrierLabel(g.englishBarrier)}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
