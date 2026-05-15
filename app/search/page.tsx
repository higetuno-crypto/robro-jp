import Link from 'next/link';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { searchRobloxGames } from '@/lib/roblox-search';
import { formatNumber } from '@/lib/format';

/**
 * /search?q=KEYWORD
 *
 * ハイブリッド検索結果ページ：
 *  - DB ヒット（自サイト掲載中）を上に「掲載中」ラベル付きで
 *  - Roblox 公式検索ヒット（外部）を下に「Roblox」ラベル付きで
 *
 * クリック先はどちらも /game/[universeId]。
 * 外部ゲームは詳細ページ初訪問時に on-demand upsert される（同ページ参照）。
 */

export const metadata: Metadata = {
  title: 'ゲーム検索',
  description: 'Roblox ゲームを横断検索',
};

export const dynamic = 'force-dynamic';

interface DbHit {
  universeId: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  playing: number | null;
}

export default async function SearchPage(
  props: {
    searchParams: Promise<{ q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? '').trim().slice(0, 100);

  if (!q) {
    return (
      <main className="max-w-3xl mx-auto px-3 py-6">
        <h1 className="text-[18px] font-semibold mb-2">ゲーム検索</h1>
        <p className="text-[13px] text-muted-foreground">
          ヘッダーの検索ボックスにキーワードを入力してください。
        </p>
      </main>
    );
  }

  const supabase = createBrowserClient();
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const [dbRes, robloxHits] = await Promise.all([
    supabase
      .from('games')
      .select(
        'universe_id, name, creator_name, thumbnail_url, game_snapshots(playing, captured_at)'
      )
      .or(`name.ilike.${pattern},creator_name.ilike.${pattern}`)
      .limit(30),
    searchRobloxGames(q, 30),
  ]);

  if (dbRes.error) {
    console.error('[search page] db error:', dbRes.error);
  }

  const dbHits: DbHit[] = (dbRes.data ?? []).map((r) => {
    const snaps = (r.game_snapshots ?? []) as Array<{
      playing: number;
      captured_at: string;
    }>;
    const latest =
      snaps.length > 0
        ? snaps.sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0]
            .playing
        : null;
    return {
      universeId: r.universe_id,
      name: r.name,
      creatorName: r.creator_name,
      thumbnailUrl: r.thumbnail_url,
      playing: latest,
    };
  });
  dbHits.sort((a, b) => (b.playing ?? 0) - (a.playing ?? 0));

  const dbIds = new Set(dbHits.map((h) => h.universeId));
  const externalHits = robloxHits.filter((h) => !dbIds.has(h.universeId));

  return (
    <main className="max-w-3xl mx-auto px-3 py-4">
      <h1 className="text-[16px] font-semibold mb-1">「{q}」の検索結果</h1>
      <p className="text-[12px] text-muted-foreground mb-4">
        掲載中：{dbHits.length} 件 ／ Roblox から：{externalHits.length} 件
      </p>

      {dbHits.length === 0 && externalHits.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          該当するゲームが見つかりませんでした。別のキーワードを試してください。
        </p>
      ) : null}

      {dbHits.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[13px] font-medium mb-2 text-muted-foreground">
            掲載中のゲーム
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {dbHits.map((h) => (
              <ResultRow
                key={h.universeId}
                universeId={h.universeId}
                name={h.name}
                creatorName={h.creatorName}
                thumbnailUrl={h.thumbnailUrl}
                playing={h.playing}
                badge={{ label: '掲載中', tone: 'in' }}
              />
            ))}
          </ul>
        </section>
      )}

      {externalHits.length > 0 && (
        <section>
          <h2 className="text-[13px] font-medium mb-2 text-muted-foreground">
            Roblox の検索結果
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {externalHits.map((h) => (
              <ResultRow
                key={h.universeId}
                universeId={h.universeId}
                name={h.name}
                creatorName={h.creatorName}
                thumbnailUrl={h.thumbnailUrl}
                playing={h.playing}
                badge={{ label: 'Roblox', tone: 'ext' }}
              />
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Roblox の検索結果は ro-brojp が公式 API
            から取得して表示しているもので、ランキング掲載対象ではありません。
          </p>
        </section>
      )}
    </main>
  );
}

function ResultRow({
  universeId,
  name,
  creatorName,
  thumbnailUrl,
  playing,
  badge,
}: {
  universeId: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  playing: number | null;
  badge: { label: string; tone: 'in' | 'ext' };
}) {
  return (
    <li>
      <Link
        href={`/game/${universeId}`}
        className="flex items-center gap-3 px-2 py-2 hover:bg-muted"
      >
        <div className="w-[48px] h-[48px] bg-muted overflow-hidden shrink-0">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            (<img
              src={thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />)
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] truncate">{name}</div>
          <div className="text-[12px] text-muted-foreground truncate">
            {creatorName ?? '—'}
          </div>
        </div>
        <span
          className={`text-[10px] leading-none px-1.5 py-1 shrink-0 ${
            badge.tone === 'in'
              ? 'bg-foreground text-background'
              : 'border border-border text-muted-foreground'
          }`}
        >
          {badge.label}
        </span>
        <div className="text-[12px] tabular-nums w-[70px] text-right shrink-0">
          {playing != null ? formatNumber(playing) : '—'}
        </div>
      </Link>
    </li>
  );
}
