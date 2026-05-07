import Link from 'next/link';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { fetchFeatured } from '@/lib/featured-query';
import { formatRelativeJa } from '@/lib/format';
import { PurposePicker } from '@/components/PurposePicker';
import { WelcomeStrip } from '@/components/WelcomeStrip';

/**
 * 日本で人気ランキング（/）← デフォルト
 *
 * CLAUDE.md：
 * - 日本語ファースト。ルートは「日本で人気」
 * - 現状は is_japanese=true を一次シグナルとして近似
 *   （Roblox公式 country=JP フィルタは匿名APIでは効かないため）
 * - revalidate = 300
 *
 * トップページ上部に「ピックアップ」の導線ミニセクション。
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: '日本で人気の Roblox ゲームランキング',
  description:
    'robro-jp が独自集計する日本ユーザー向け Roblox ゲームの人気ランキング TOP100。CCU・タグ・配信向け情報を日本語で発見できる。',
  alternates: { canonical: 'https://ro-brojp.com/' },
  openGraph: {
    title: '日本で人気の Roblox ゲームランキング | ro-brojp',
    description:
      '日本ユーザー向けに独自集計した Roblox 人気ゲーム TOP100。',
    url: 'https://ro-brojp.com/',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'ro-brojp',
  },
};

export default async function JapanPopularRankingPage() {
  const supabase = createBrowserClient();
  const [jpRanking, featured] = await Promise.all([
    getRanking(supabase, 'japanese', 100),
    fetchFeatured(supabase, 3),
  ]);

  // フォールバック：日本語ゲームが検出されていないときは全世界総合を表示
  // （初回アクセスでも「データ収集中」になって手触りが悪いのを回避）
  const usingFallback = jpRanking.rows.length === 0;
  const { rows, capturedAt } = usingFallback
    ? await getRanking(supabase, 'overall', 100)
    : jpRanking;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '日本で人気の Roblox ゲームランキング',
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 50).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ro-brojp.com/game/${r.universeId}`,
      name: r.name,
    })),
  };

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <WelcomeStrip />
      <PurposePicker />

      {featured.length > 0 && (
        <div className="border-b border-border px-3 py-3">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[13px] font-medium">ピックアップ</div>
            <Link
              href="/featured"
              className="text-[12px] text-muted-foreground hover:underline"
            >
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {featured.map((f) => (
              <Link
                key={f.id}
                href={`/game/${f.universeId}`}
                className="block border border-border bg-card hover:bg-muted/40"
              >
                <div className="aspect-[16/9] bg-muted overflow-hidden">
                  {f.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="p-2">
                  <div className="text-[12px] leading-tight truncate font-medium">
                    {f.headline}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {f.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length === 0
          ? 'データ収集中です。cron が一度回れば表示されます。'
          : usingFallback
          ? `${formatRelativeJa(capturedAt)} ・ 日本語ゲーム未検出のため暫定で全世界総合を表示中（TOP${rows.length}）`
          : `${formatRelativeJa(capturedAt)} ・ 日本で人気 TOP${rows.length}`}
      </div>

      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>

      {rows.length > 0 && (
        <div className="border-t border-border px-3 py-5 mt-2">
          <div className="text-[13px] leading-relaxed text-muted-foreground">
            <p>このサイトは一人で開発・運用しています。</p>
            <p className="mt-1">
              特に「日本で人気」ランキングは独自プログラムで集計しているため、
              まだうまく機能していません。
            </p>
            <p className="mt-1">皆さんの力でこのサイトを完成させてくれませんか？</p>
          </div>
          <div className="mt-3">
            <Link
              href="/feedback"
              className="inline-block text-[13px] underline hover:no-underline"
            >
              → ご意見・要望を送る
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
