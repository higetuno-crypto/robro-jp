import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { fetchGameDetail, fetchRecentSnapshots } from '@/lib/game-detail-query';
import { ensureGameInDb } from '@/lib/ensure-game';
import { TrendChart } from '@/components/TrendChart';
import { TagCloud } from '@/components/tag/TagCloud';
import { TagPickerModal } from '@/components/tag/TagPickerModal';
import { fetchAllTags, fetchGameTags } from '@/lib/tags';
import { VoteButtons } from '@/components/VoteButtons';
import { fetchGameButtonVotes } from '@/lib/votes';
import { fetchStreamingMeta } from '@/lib/streaming';
import { StreamMetaPanel } from '@/components/stream/StreamMetaPanel';
import { formatNumber, formatRelativeJa } from '@/lib/format';
import { ReportButton } from '@/components/ReportButton';

/**
 * 個別ゲーム詳細ページ
 *
 * 表示内容：
 *  - サムネ、タイトル、開発者
 *  - 現在CCU（直近スナップショット）
 *  - 24時間CCU推移グラフ（Recharts）
 *  - 公式Robloxへの遷移ボタン
 *
 * CLAUDE.md UI原則：ランキング側と同様、装飾は最小限。
 */

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { universeId: string };
}): Promise<Metadata> {
  const universeId = Number(params.universeId);
  if (!Number.isFinite(universeId) || universeId <= 0) {
    return { title: 'ゲームが見つかりません' };
  }
  const supabase = createBrowserClient();
  const game = await fetchGameDetail(supabase, universeId).catch(() => null);
  if (!game) return { title: 'ゲームが見つかりません' };

  const desc = game.description
    ? game.description.replace(/\s+/g, ' ').slice(0, 160)
    : `${game.name}（${game.creatorName ?? '開発者不明'}）の Roblox ゲーム情報、現在CCU、24時間推移、タグ、配信向け情報。`;
  const url = `https://ro-brojp.com/game/${universeId}`;

  return {
    title: game.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${game.name} | ro-brojp`,
      description: desc,
      url,
      type: 'article',
      images: game.thumbnailUrl ? [{ url: game.thumbnailUrl }] : undefined,
      locale: 'ja_JP',
      siteName: 'ro-brojp',
    },
    twitter: {
      card: 'summary_large_image',
      title: game.name,
      description: desc,
      images: game.thumbnailUrl ? [game.thumbnailUrl] : undefined,
    },
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: { universeId: string };
}) {
  const universeId = Number(params.universeId);
  if (!Number.isFinite(universeId) || universeId <= 0) notFound();

  const supabase = createBrowserClient();
  const [initialGame, snaps, tagBundle, allTags, streamingMeta, voteCounts] = await Promise.all([
    fetchGameDetail(supabase, universeId),
    fetchRecentSnapshots(supabase, universeId, 24),
    fetchGameTags(supabase, universeId, { userTagLimit: 5 }).catch((e) => {
      console.error('[detail fetchGameTags]', e);
      return { official: [], community: [] };
    }),
    fetchAllTags(supabase).catch((e) => {
      console.error('[detail fetchAllTags]', e);
      return [];
    }),
    fetchStreamingMeta(supabase, universeId).catch((e) => {
      console.error('[detail fetchStreamingMeta]', e);
      return null;
    }),
    fetchGameButtonVotes(supabase, universeId).catch((e) => {
      console.error('[detail fetchGameButtonVotes]', e);
      return { like: 0, save: 0, recommend: 0 };
    }),
  ]);
  // 検索からの遷移などで DB に未登録のゲームは on-demand で取得して upsert する
  let game = initialGame;
  if (!game) {
    game = await ensureGameInDb(universeId);
    if (!game) notFound();
  }

  const latest = snaps.length > 0 ? snaps[snaps.length - 1] : null;
  const robloxUrl = game.placeId
    ? `https://www.roblox.com/games/${game.placeId}`
    : null;

  const totalVotes = voteCounts.like + voteCounts.save + voteCounts.recommend;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: game.description?.slice(0, 500) ?? undefined,
    url: `https://ro-brojp.com/game/${universeId}`,
    image: game.thumbnailUrl ?? undefined,
    inLanguage: game.isJapanese ? 'ja' : undefined,
    gamePlatform: 'Roblox',
    author: game.creatorName
      ? {
          '@type': game.creatorType === 'Group' ? 'Organization' : 'Person',
          name: game.creatorName,
        }
      : undefined,
    sameAs: robloxUrl ?? undefined,
    aggregateRating:
      totalVotes > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: totalVotes > 0
              ? (
                  (voteCounts.like + voteCounts.save * 2 + voteCounts.recommend * 4.2) /
                  (totalVotes * 4.2) *
                  5
                ).toFixed(2)
              : undefined,
            ratingCount: totalVotes,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ランキング', item: 'https://ro-brojp.com/' },
      { '@type': 'ListItem', position: 2, name: game.name, item: `https://ro-brojp.com/game/${universeId}` },
    ],
  };

  return (
    <section className="max-w-3xl mx-auto px-3 py-3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* パンくず */}
      <div className="text-[13px] text-muted-foreground mb-3">
        <Link href="/" className="hover:underline">
          ランキング
        </Link>
        <span className="mx-1">/</span>
        <span>ゲーム詳細</span>
      </div>

      {/* 基本情報 */}
      <div className="flex gap-3">
        <div className="w-[96px] h-[96px] bg-muted overflow-hidden shrink-0">
          {game.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.thumbnailUrl}
              alt=""
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] leading-tight font-medium break-words">
            {game.name}
          </h1>
          <div className="text-[13px] text-muted-foreground mt-0.5">
            {game.creatorName ?? '-'}
            {game.creatorType ? `（${game.creatorType}）` : ''}
          </div>
          {game.isJapanese && (
            <div className="mt-1 inline-block text-[11px] text-blue-700 border border-blue-200 px-1.5 py-0.5">
              日本語
            </div>
          )}
        </div>
      </div>

      {/* 3ボタン投票（フェーズ8） */}
      <div className="mt-4">
        <VoteButtons
          universeId={universeId}
          initial={{
            like: { count: voteCounts.like, voted: false },
            save: { count: voteCounts.save, voted: false },
            recommend: { count: voteCounts.recommend, voted: false },
          }}
        />
      </div>

      {/* タグ */}
      {(tagBundle.official.length > 0 || tagBundle.community.length > 0 || allTags.length > 0) && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[13px] text-muted-foreground">タグ</div>
            {allTags.length > 0 && (
              <TagPickerModal universeId={universeId} tags={allTags} />
            )}
          </div>
          <TagCloud official={tagBundle.official} community={tagBundle.community} />
        </div>
      )}

      {/* 公式Robloxリンク */}
      <div className="mt-5">
        {robloxUrl ? (
          <a
            href={robloxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 text-[14px] bg-foreground text-background hover:opacity-90"
          >
            Robloxで開く
          </a>
        ) : (
          <span className="text-[13px] text-muted-foreground">
            Robloxリンクは未取得です。
          </span>
        )}
      </div>

      {/* 概要 */}
      {game.description ? (
        <div className="mt-5">
          <div className="text-[13px] text-muted-foreground mb-1">概要</div>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {game.description}
          </p>
        </div>
      ) : null}

      {/* 現在CCU */}
      <div className="mt-5 flex items-baseline gap-2">
        <div className="text-[13px] text-muted-foreground">現在CCU</div>
        <div className="text-[20px] tabular-nums font-medium">
          {latest ? formatNumber(latest.playing) : '-'}
        </div>
        <div className="text-[12px] text-muted-foreground ml-auto">
          {latest ? formatRelativeJa(latest.capturedAt) : ''}
        </div>
      </div>

      {/* 配信者向け情報（メタ存在時のみ） */}
      {streamingMeta && (
        <StreamMetaPanel meta={streamingMeta} gameName={game.name} />
      )}

      {/* 24hグラフ */}
      <div className="mt-2">
        <div className="text-[13px] text-muted-foreground mb-1">24時間のCCU推移</div>
        <TrendChart data={snaps} />
      </div>

      <div className="mt-6 text-right">
        <ReportButton targetType="game" targetId={Number(game.universeId)} />
      </div>
    </section>
  );
}
