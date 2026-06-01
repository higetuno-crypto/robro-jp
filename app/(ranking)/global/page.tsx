import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

export const metadata: Metadata = {
  title: '全世界総合 Roblox ゲームランキング',
  description:
    '世界全体で今プレイされている Roblox ゲームを同時接続数（CCU）順で一覧。日本で人気のタイトルとの違いを比べたい人向け。',
  alternates: { canonical: 'https://ro-brojp.com/global' },
  openGraph: {
    title: '全世界総合 Roblox ゲームランキング | ro-brojp',
    description:
      '世界全体で今プレイされている Roblox ゲームを同時接続数（CCU）順で一覧。',
    url: 'https://ro-brojp.com/global',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'ro-brojp',
  },
};

/**
 * 全世界総合ランキング（/global）
 *
 * CLAUDE.md：
 * - 日本語ファースト原則により「/」のメインから格下げ
 * - 最新スナップショットの playing 降順 TOP100
 */
export const revalidate = 300;

export default async function GlobalRankingPage() {
  const supabase = createBrowserClient();
  const { rows, capturedAt } = await getRanking(supabase, 'overall', 100);

  return (
    <section>
      <h1 className="px-3 pt-3 pb-1 text-[14px] font-medium">
        全世界で今プレイされている Roblox ゲーム
      </h1>
      <div className="px-3 pb-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ 全世界総合 TOP${rows.length}`
          : 'データ収集中です。cron が一度回れば表示されます。'}
      </div>
      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
