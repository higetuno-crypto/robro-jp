import { createServiceClient } from '@/lib/supabase';
import { GameSearchForm } from './GameSearchForm';

export const dynamic = 'force-dynamic';

interface RecentGameRow {
  universeId: number;
  name: string;
  creatorName: string | null;
  voteRowCount: number;
}

async function fetchRecentVotedGames(): Promise<RecentGameRow[]> {
  const supabase = createServiceClient();
  // 最近投票があったゲームTOP30（管理画面の入口に並べる）
  const { data, error } = await supabase
    .from('game_tag_votes')
    .select('universe_id, last_voted_at')
    .order('last_voted_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const seen = new Map<number, number>();
  for (const r of data ?? []) {
    const id = r.universe_id as number;
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const ids = Array.from(seen.keys()).slice(0, 30);
  if (ids.length === 0) return [];
  const { data: games, error: gErr } = await supabase
    .from('games')
    .select('universe_id, name, creator_name')
    .in('universe_id', ids);
  if (gErr) throw gErr;
  return (games ?? []).map((g) => ({
    universeId: g.universe_id as number,
    name: g.name as string,
    creatorName: (g.creator_name as string | null) ?? null,
    voteRowCount: seen.get(g.universe_id as number) ?? 0,
  }));
}

export default async function AdminGamesPage() {
  const recent = await fetchRecentVotedGames();
  return (
    <div className="space-y-6 text-[14px]">
      <section>
        <h2 className="text-[15px] font-semibold mb-2">ゲームを指定</h2>
        <p className="text-[12px] text-muted-foreground mb-2">
          universeId または ゲームURL（roblox.com/games/…）を貼り付け。
        </p>
        <GameSearchForm />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold mb-2">最近タグが付いたゲーム</h2>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">まだ投票がありません。</p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {recent.map((g) => (
              <li key={g.universeId}>
                <a
                  href={`/admin/games/${g.universeId}`}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {g.creatorName ?? '—'} / universe {g.universeId}
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground tabular-nums">
                    {g.voteRowCount} タグ
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
