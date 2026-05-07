import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

export const metadata: Metadata = {
  title: '急上昇 Roblox ゲームランキング',
  description: '前回スナップショットからの CCU 伸び率で並べた急上昇 Roblox ゲーム TOP100。',
  alternates: { canonical: 'https://ro-brojp.com/trending' },
};

/**
 * 急上昇ランキング（/trending）
 * 前スナップショット比で playing が倍率的に伸びている順。
 *
 * 計算ロジックは lib/ranking-query.ts 参照（スムージング定数 K=100）。
 */
export const revalidate = 300;

export default async function TrendingRankingPage() {
  const supabase = createBrowserClient();
  const { rows, capturedAt } = await getRanking(supabase, 'trending', 100);

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ 急上昇 TOP${rows.length}`
          : 'スナップショットが2点以上揃うと表示されます（cronが最低2回回るまで待機）。'}
      </div>
      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
