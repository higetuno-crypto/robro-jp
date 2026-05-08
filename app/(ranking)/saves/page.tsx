import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getVoteRanking } from '@/lib/vote-ranking-query';
import { VoteRankingRow } from '@/components/VoteRankingRow';

export const metadata: Metadata = {
  title: '⭐ お気に入り ランキング',
  description:
    'ユーザーが「⭐お気に入り」を押した数（ベイズ平均）で並べた Roblox ゲームランキング TOP100。',
  alternates: { canonical: 'https://ro-brojp.com/saves' },
};

/**
 * お気に入りランキング（/saves）
 *
 * ⭐ お気に入りボタンの票数（ベイズ平均）順。
 * idea-evaluation-v3.md §B5：4種ランキングの1つ。
 */
export const revalidate = 300;

export default async function SavesRankingPage() {
  const supabase = createBrowserClient();
  const { rows } = await getVoteRanking(supabase, 'save', { limit: 100 });

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length === 0
          ? 'まだお気に入り登録がありません。気になるゲームの詳細で ⭐ を押すとここに反映されます。'
          : `⭐ お気に入り ランキング TOP${rows.length}`}
      </div>
      <div>
        {rows.map((r) => (
          <VoteRankingRow key={r.universeId} row={r} emoji="⭐" />
        ))}
      </div>
    </section>
  );
}
