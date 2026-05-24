import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

export const metadata: Metadata = {
  title: '今週の新着 Roblox ゲーム',
  description:
    '直近1週間に新しく登場した Roblox ゲームを同時接続数（CCU）順で一覧化。注目の新作を素早く見つけたい人向け。',
  alternates: { canonical: 'https://ro-brojp.com/new' },
  openGraph: {
    title: '今週の新着 Roblox ゲーム | ro-brojp',
    description:
      '直近1週間に新しく登場した Roblox ゲームを同時接続数（CCU）順で一覧化。',
    url: 'https://ro-brojp.com/new',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'ro-brojp',
  },
};

/**
 * 今週の新着ランキング（/new）
 *
 * - games.first_seen_at >= now() - 7 days
 * - playing 降順
 * - 全世界対象（日本限定ではない）。ここは「発見」の場なので母集団を広く取る
 */
export const revalidate = 300;

export default async function NewRankingPage() {
  const supabase = createBrowserClient();
  const { rows, capturedAt } = await getRanking(supabase, 'new', 100, {
    newWithinDays: 7,
  });

  return (
    <section>
      <h1 className="px-3 pt-3 pb-1 text-[14px] font-medium">
        今週新しく登場した Roblox ゲーム
      </h1>
      <div className="px-3 pb-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ 今週の新着 TOP${rows.length}`
          : '過去7日に初検出されたゲームはまだありません。データ蓄積が進むと表示されます。'}
      </div>
      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
