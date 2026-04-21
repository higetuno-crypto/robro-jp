import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

/**
 * 日本語ゲームランキング（/japanese）
 * is_japanese=true のみに絞った playing 降順 TOP100。
 *
 * 注：現時点の japanese-detector はルールベース。
 * グローバルTOP500には日本語ゲームが少ないため0件になることがある。
 * これはフェーズ1の既知課題。memoryにも記録。
 */
export const revalidate = 300;

export default async function JapaneseRankingPage() {
  const supabase = createBrowserClient();
  const { rows, capturedAt } = await getRanking(supabase, 'japanese', 100);

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ 日本語 TOP${rows.length}`
          : '日本語ゲームはまだ検出されていません。データ収集が進むと表示されます。'}
      </div>
      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
