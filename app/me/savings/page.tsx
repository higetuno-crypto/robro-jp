import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase-ssr';
import { formatNumber, formatRelativeJa } from '@/lib/format';
import { fetchAccountBadges, badgeDisplayLabel, BADGE_DEFS } from '@/lib/badges';

/**
 * フェーズ8：マイリスト（自分が ⭐ を付けたゲーム一覧）
 *
 * ⭐ ボタンの二重用途（feature-spec.md §10.1）：
 *  - ランキングへの票（game_button_vote_logs）
 *  - 個人マイリスト（user_savings）← このページで一覧
 *
 * RLS により本人のみアクセス可。
 */

export const dynamic = 'force-dynamic';

interface SavingRow {
  added_at: string;
  universe_id: number;
  games: {
    universe_id: number;
    name: string;
    creator_name: string | null;
    thumbnail_url: string | null;
  } | null;
}

export default async function SavingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/me/savings');
  }

  const supabase = createSupabaseServerClient();
  const [savingsRes, badges] = await Promise.all([
    supabase
      .from('user_savings')
      .select(
        'added_at, universe_id, games!inner(universe_id, name, creator_name, thumbnail_url)'
      )
      .eq('account_id', user.id)
      .order('added_at', { ascending: false }),
    fetchAccountBadges(supabase, user.id),
  ]);

  const rows = (savingsRes.data ?? []) as unknown as SavingRow[];
  if (savingsRes.error) console.error('[me/savings]', savingsRes.error);

  return (
    <main className="max-w-3xl mx-auto">
      <div className="px-3 py-3 border-b border-border">
        <h1 className="text-[16px] font-medium">⭐ マイリスト</h1>
        <div className="text-[13px] text-muted-foreground mt-0.5">
          {rows.length === 0
            ? 'まだマイリストにゲームがありません。気になるゲームの詳細で ⭐ を押してください。'
            : `${formatNumber(rows.length)} 件`}
        </div>
      </div>

      <section className="px-3 py-3 border-b border-border">
        <h2 className="text-[14px] font-medium mb-2">あなたのバッジ</h2>
        {badges.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            まだバッジがありません。タグ投票や早期登録で獲得できます。
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((b) => {
              const def = BADGE_DEFS[b.badgeKey];
              return (
                <li
                  key={b.badgeKey}
                  className="border border-border px-2 py-1 text-[12px]"
                  title={def?.description ?? ''}
                >
                  {badgeDisplayLabel(b)}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          🏷️ タグ職人は10票ごとにランクアップ／🥇 最初の発見者はゲーム単位／🌱 早期アクセスは 2026-11-30 までの登録者
        </p>
      </section>

      <div>
        {rows.map((s) => {
          const g = s.games;
          if (!g) return null;
          return (
            <Link
              key={s.universe_id}
              href={`/game/${s.universe_id}`}
              className="grid grid-cols-[60px_1fr_auto] gap-3 items-center px-3 py-2 border-b border-border hover:bg-muted/50"
            >
              <div className="w-[60px] h-[60px] bg-muted overflow-hidden shrink-0">
                {g.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.thumbnail_url}
                    alt=""
                    width={60}
                    height={60}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] leading-tight truncate">{g.name}</div>
                <div className="text-[14px] leading-tight text-muted-foreground truncate">
                  {g.creator_name ?? '-'}
                </div>
              </div>
              <div className="text-[12px] text-muted-foreground tabular-nums">
                {formatRelativeJa(s.added_at)}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
