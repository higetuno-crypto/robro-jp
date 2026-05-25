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

export async function generateMetadata(
  props: {
    params: Promise<{ universeId: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const universeId = Number(params.universeId);
  if (!Number.isFinite(universeId) || universeId <= 0) {
    return { title: 'ゲームが見つかりません' };
  }
  const supabase = createBrowserClient();
  const [game, streamingMeta] = await Promise.all([
    fetchGameDetail(supabase, universeId).catch(() => null),
    fetchStreamingMeta(supabase, universeId).catch(() => null),
  ]);
  if (!game) return { title: 'ゲームが見つかりません' };

  // REC-001：検索意図ベースのテンプレに統一。pitch があればフックとして使う
  const pitch = streamingMeta?.shortPitchJa?.trim() || null;
  const titleBase = pitch
    ? `${game.name} | ${pitch}`
    : `${game.name} | Roblox ゲーム情報`;
  const desc = pitch
    ? `${game.name}：${pitch}。同時接続数（CCU）の推移と日本語タグ・配信向け情報を集約。`
    : `${game.name} の同時接続数（CCU）推移と日本語タグ・配信向け情報。Roblox ゲームの日本人向けまとめ。`;
  const url = `https://ro-brojp.com/game/${universeId}`;
  const ogImage = `https://ro-brojp.com/api/og/game/${universeId}`;

  return {
    title: titleBase,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${titleBase} | ro-brojp`,
      description: desc,
      url,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      locale: 'ja_JP',
      siteName: 'ro-brojp',
    },
    twitter: {
      card: 'summary_large_image',
      title: titleBase,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function GameDetailPage(
  props: {
    params: Promise<{ universeId: string }>;
  }
) {
  const params = await props.params;
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
  const descriptionPreview = game.description
    ? game.description.slice(0, 200)
    : null;
  const isDescriptionTruncated = Boolean(
    game.description && game.description.length > (descriptionPreview?.length ?? 0)
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: descriptionPreview ?? undefined,
    url: `https://ro-brojp.com/game/${universeId}`,
    image: game.thumbnailUrl ?? undefined,
    inLanguage: game.isJapanese ? 'ja' : undefined,
    applicationCategory: 'Game',
    gamePlatform: 'Roblox',
    // publisher: ゲームが乗っているプラットフォーム提供者。
    // 公式サービスである旨は別途フッターで否定明記、author に実際の開発者を載せて区別する（CLAUDE.md §2 許容範囲）
    publisher: {
      '@type': 'Organization',
      name: 'Roblox Corporation',
    },
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
            (<img
              src={game.thumbnailUrl}
              alt=""
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />)
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
      {descriptionPreview ? (
        <div className="mt-5">
          <div className="text-[13px] text-muted-foreground mb-1">概要</div>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {descriptionPreview}
            {isDescriptionTruncated ? '…' : ''}
          </p>
          {robloxUrl ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              詳細な説明は{' '}
              <a
                href={robloxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Robloxで見る
              </a>
            </p>
          ) : null}
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
      {/* 内部リンク：このゲームのタグから関連ゲームを辿れる導線（クローラビリティ＆滞在向上） */}
      {(tagBundle.official.length > 0 || tagBundle.community.length > 0) && (
        <nav className="mt-8 border-t border-border pt-4">
          <div className="text-[13px] text-muted-foreground mb-2">同じタグのゲームを探す</div>
          <ul className="flex flex-wrap gap-2">
            {[...tagBundle.official, ...tagBundle.community].slice(0, 8).map((t) => (
              <li key={t.tagId}>
                <Link
                  href={`/tags/${encodeURIComponent(t.tagId)}`}
                  className="inline-flex items-center text-[12px] leading-none px-2 py-1 border border-border hover:bg-muted"
                >
                  #{t.tagName}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {/* 主要ランキングへの導線（孤立ページ防止 + 内部リンクハブ） */}
      <nav className="mt-6 border-t border-border pt-4">
        <div className="text-[13px] text-muted-foreground mb-2">他のランキングを見る</div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <li><Link href="/" className="underline">日本で人気</Link></li>
          <li><Link href="/trending" className="underline">急上昇</Link></li>
          <li><Link href="/recommends" className="underline">🔥頼むから人来て</Link></li>
          <li><Link href="/new" className="underline">新着</Link></li>
          <li><Link href="/featured" className="underline">ピックアップ</Link></li>
          <li><Link href="/stream" className="underline">配信ネタ</Link></li>
        </ul>
      </nav>
      <div className="mt-6 text-right">
        <ReportButton targetType="game" targetId={Number(game.universeId)} />
      </div>
    </section>
  );
}
