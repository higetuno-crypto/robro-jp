import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import {
  fetchTagBySlug,
  fetchGamesForTag,
  type TagGroup,
} from '@/lib/tags';
import { formatNumber } from '@/lib/format';

export const revalidate = 300;

const GROUP_LABEL: Record<TagGroup, string> = {
  format: '遊び方',
  difficulty: '難易度・英語',
  reaction: 'リアクション',
  participation: '参加形式',
  vibe: '空気感',
  caution: '注意点',
  genre: 'ジャンル',
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createBrowserClient();
  const slug = decodeURIComponent(params.slug);
  const tag = await fetchTagBySlug(supabase, slug);
  if (!tag) return { title: 'タグが見つかりません' };
  const url = `https://ro-brojp.com/tags/${encodeURIComponent(slug)}`;
  const ogImage = `https://ro-brojp.com/api/og/tag/${encodeURIComponent(slug)}`;
  const desc = tag.description ?? `${tag.tagName} タグが付けられた Roblox ゲーム一覧。`;
  return {
    title: `${tag.tagName}タグのゲーム`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `#${tag.tagName} | ro-brojp`,
      description: desc,
      url,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      locale: 'ja_JP',
      siteName: 'ro-brojp',
    },
    twitter: {
      card: 'summary_large_image',
      title: `#${tag.tagName}`,
      description: desc,
      images: [ogImage],
    },
  };
}

/**
 * /tags/[slug]
 *
 * CLAUDE.md UI原則（タグページ）：タグ詳細＋紐づくゲーム一覧。
 * ゲーム一覧は confidence_score 降順（少数高得票より、多数の合意を優先）。
 * 行の見た目はランキングと似せつつ、順位の色差は省く（ランキングページではないため）。
 */

export default async function TagDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const supabase = createBrowserClient();
  const tag = await fetchTagBySlug(supabase, slug);
  if (!tag) notFound();

  const games = await fetchGamesForTag(supabase, slug, 50);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${tag.tagName} タグの Roblox ゲーム`,
    description: tag.description ?? undefined,
    numberOfItems: games.length,
    itemListElement: games.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ro-brojp.com/game/${g.universeId}`,
      name: g.name,
    })),
  };

  return (
    <main className="max-w-3xl mx-auto px-3 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <nav className="text-[12px] text-muted-foreground mb-3">
        <Link href="/tags" className="hover:underline">
          ← タグ一覧
        </Link>
      </nav>

      <header className="mb-5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center text-[13px] leading-none px-2 py-1 ${
              tag.tagType === 'official'
                ? 'bg-foreground text-background'
                : 'border border-foreground text-foreground'
            }`}
          >
            {tag.tagName}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {GROUP_LABEL[tag.tagGroup]}・
            {tag.tagType === 'official' ? '公式タグ' : 'ユーザータグ'}
          </span>
        </div>
        {tag.description && (
          <p className="text-[13px] text-muted-foreground">{tag.description}</p>
        )}
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {tag.gameCount} ゲーム / 合計 {tag.totalVoteCount} 票
        </p>
      </header>

      {games.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          このタグが付いたゲームはまだありません。
          <Link href="/" className="underline">
            ランキングからゲームを見る
          </Link>
          。
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {games.map((g, i) => (
            <li key={g.universeId}>
              <Link
                href={`/game/${g.universeId}`}
                className="flex items-center gap-3 px-2 py-2 hover:bg-muted"
              >
                <span className="w-6 text-[13px] tabular-nums text-muted-foreground text-right">
                  {i + 1}
                </span>
                <div className="w-[60px] h-[60px] shrink-0 bg-muted overflow-hidden">
                  {g.thumbnailUrl ? (
                    <Image
                      src={g.thumbnailUrl}
                      alt={g.name}
                      width={60}
                      height={60}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] truncate">{g.name}</div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {g.creatorName ?? '不明'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] tabular-nums">
                    {g.playing === null ? '―' : formatNumber(g.playing)}
                  </div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">
                    {g.voteCount}票
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
