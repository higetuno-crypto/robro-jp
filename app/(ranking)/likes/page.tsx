import { createBrowserClient } from '@/lib/supabase';
import { getVoteRanking } from '@/lib/vote-ranking-query';
import { VoteRankingRow } from '@/components/VoteRankingRow';

/**
 * 好きランキング（/likes）
 *
 * ❤️ 好きボタンの票数（ベイズ平均）順。
 * idea-evaluation-v3.md §B5：4種ランキングの1つ。
 *
 * - データソース：マテビュー game_voting_scores（10分ごと REFRESH）
 * - 並び順：like_score 降順（ベイズ平均で少数票の罠を回避）
 */
export const revalidate = 300;

export default async function LikesRankingPage() {
  const supabase = createBrowserClient();
  const { rows } = await getVoteRanking(supabase, 'like', { limit: 100 });

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length === 0
          ? 'まだ投票がありません。お気に入りのゲーム詳細で ❤️ を押すとここに反映されます。'
          : `❤️ 好き ランキング TOP${rows.length}`}
      </div>
      <div>
        {rows.map((r) => (
          <VoteRankingRow key={r.universeId} row={r} emoji="❤️" />
        ))}
      </div>
    </section>
  );
}
