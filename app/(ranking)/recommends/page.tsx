import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getVoteRanking } from '@/lib/vote-ranking-query';
import { VoteRankingRow } from '@/components/VoteRankingRow';

export const metadata: Metadata = {
  title: '🔥 頼むから人来て ランキング',
  description:
    '「もっと知られてほしい」と思った Roblox ゲームに🔥を投じる、robro-jp 独自の隠れ良作ランキング TOP100。',
  alternates: { canonical: 'https://ro-brojp.com/recommends' },
};

/**
 * 「頼むから人来て」ランキング（/recommends）
 *
 * 🔥 ボタンの票数（ベイズ平均）順。ro-brojp の中核差別化要素。
 * idea-evaluation-v3.md §A3 / §B5。
 */
export const revalidate = 300;

export default async function RecommendsRankingPage() {
  const supabase = createBrowserClient();
  const { rows } = await getVoteRanking(supabase, 'recommend', { limit: 100 });

  return (
    <section>
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length === 0
          ? 'まだ「頼むから人来て」がありません。誰かに知ってほしいゲームの詳細で 🔥 を押すとここに反映されます。'
          : `🔥 頼むから人来て ランキング TOP${rows.length}`}
      </div>
      <div>
        {rows.map((r) => (
          <VoteRankingRow key={r.universeId} row={r} emoji="🔥" />
        ))}
      </div>
    </section>
  );
}
