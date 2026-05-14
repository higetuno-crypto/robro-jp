import Link from 'next/link';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { fetchFeatured } from '@/lib/featured-query';
import { formatRelativeJa } from '@/lib/format';
import { PurposePicker } from '@/components/PurposePicker';
import { WelcomeStrip } from '@/components/WelcomeStrip';
import { BuildJapanRankingHero } from '@/components/BuildJapanRankingHero';
import { getBuildProgress } from '@/lib/build-progress';

/**
 * みんなで作る日本ランキング（/）← デフォルト
 *
 * CLAUDE.md：
 * - 日本語ファースト。ルートは日本ユーザー向けランキング
 * - 推定型 is_japanese 判定では母数が足りないため、フェーズ8の集合知投票を
 *   トップヒーローに据えて「ユーザーが推しを登録 → ランキングが立ち上がる」
 *   構造に転換（北極星「優秀なクリエイターが真っ当に評価される」と直結）
 * - 既存ランキングはヒーロー下に維持（推定型はあくまで暫定の姿）
 * - revalidate = 300
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'みんなで作る日本ランキング',
  description:
    'ro-brojp は日本ユーザーの「推し」投票で立ち上げる Roblox ゲームランキング。あなたの一票で日本人向けランキングが完成します。',
  alternates: { canonical: 'https://ro-brojp.com/' },
  openGraph: {
    title: 'みんなで作る日本ランキング | ro-brojp',
    description:
      '日本ユーザーの推し投票で作る Roblox ゲームランキング。あなたの一票で完成に近づきます。',
    url: 'https://ro-brojp.com/',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'ro-brojp',
  },
};

export default async function JapanPopularRankingPage() {
  const supabase = createBrowserClient();
  const [jpRanking, featured, progress] = await Promise.all([
    getRanking(supabase, 'japanese', 100),
    fetchFeatured(supabase, 3),
    getBuildProgress(supabase),
  ]);

  // フォールバック：日本語ゲームがほとんど検出されていないときは全世界総合を表示
  // （初回アクセスでも「データ収集中」になって手触りが悪いのを回避。
  //  is_japanese 判定は近似なので、数件しか引っかからない期間が長い → 閾値で判定）
  const usingFallback = jpRanking.rows.length < 10;
  const { rows, capturedAt } = usingFallback
    ? await getRanking(supabase, 'overall', 100)
    : jpRanking;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'みんなで作る日本ランキング',
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
      <BuildJapanRankingHero progress={progress} />
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
          ? `${formatRelativeJa(capturedAt)} ・ 集合知ランキング構築中のため、暫定で全世界総合を表示中（TOP${rows.length}）`
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
              「日本で人気」ランキングはまだ立ち上がっておらず、ユーザーの投票で
              中身を作っていく仕組みに切り替えています。
            </p>
            <p className="mt-1">
              上の「あなたの推しは？」から好きなゲームを検索して、❤️⭐🔥 を一票だけ
              押してくれませんか？
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href="/likes"
              className="inline-block text-[13px] underline hover:no-underline"
            >
              → 既に集まっている投票ランキングを見る
            </Link>
            <Link
              href="/feedback"
              className="inline-block text-[13px] text-muted-foreground underline hover:no-underline"
            >
              ご意見・要望を送る
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
