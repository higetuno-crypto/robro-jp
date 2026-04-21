import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

/**
 * 総合ランキング（/）
 * 最新スナップショットの playing 降順 TOP100。
 *
 * CLAUDE.md：revalidate = 300（5分ごとの再生成）
 */
export const revalidate = 300;

export default async function OverallRankingPage() {
  const supabase = createBrowserClient();
  const { rows, capturedAt } = await getRanking(supabase, 'overall', 100);

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ 総合 TOP${rows.length}`
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
