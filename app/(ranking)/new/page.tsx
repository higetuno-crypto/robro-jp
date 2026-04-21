import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

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
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
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
