import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

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
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
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
