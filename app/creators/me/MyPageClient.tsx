'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface GameRow {
  universe_id: number;
  is_primary: boolean;
  name: string;
  thumbnail_url: string | null;
  creator_name: string | null;
}

interface Props {
  creatorId: number;
  initialGames: GameRow[];
}

export function MyPageClient({ creatorId, initialGames }: Props) {
  const router = useRouter();
  const [games, setGames] = useState<GameRow[]>(initialGames);
  const [gameUrl, setGameUrl] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = () => router.refresh();

  const addGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/creators/${creatorId}/games`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game_url: gameUrl, is_primary: isPrimary }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '登録に失敗しました');
        return;
      }
      setInfo(`「${data.game_name}」を登録しました。`);
      setGameUrl('');
      setIsPrimary(false);
      reload();
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  const setPrimary = async (universeId: number) => {
    setBusyId(universeId);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/creators/${creatorId}/games?universe_id=${universeId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ is_primary: true }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? '更新に失敗しました');
        return;
      }
      setGames((cur) =>
        cur.map((g) => ({ ...g, is_primary: g.universe_id === universeId }))
      );
    } finally {
      setBusyId(null);
    }
  };

  const removeGame = async (universeId: number, name: string) => {
    if (!confirm(`「${name}」を代表作から外しますか？`)) return;
    setBusyId(universeId);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/creators/${creatorId}/games?universe_id=${universeId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? '削除に失敗しました');
        return;
      }
      setGames((cur) => cur.filter((g) => g.universe_id !== universeId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="mt-6">
        <h2 className="text-[14px] font-semibold">代表作を追加</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Roblox の自分のゲームのページ URL を貼り付けてください。
          公開前のゲームでも、URL（<code className="font-mono text-[11px]">/games/&lt;数字&gt;/...</code>）が分かれば登録できます。
        </p>
        <form onSubmit={addGame} className="mt-3 space-y-2">
          <input
            type="url"
            value={gameUrl}
            onChange={(e) => setGameUrl(e.target.value)}
            required
            placeholder="https://www.roblox.com/games/123456789/My-Game"
            className="w-full px-2 py-1.5 text-[13px] border border-border bg-background"
          />
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            <span>代表作にする（プロフィール上部に表示）</span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted disabled:opacity-40"
          >
            {submitting ? '登録中…' : '登録'}
          </button>
        </form>

        {error ? (
          <div className="mt-3 border border-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mt-3 border border-border bg-muted/30 px-3 py-2 text-[12px]">
            {info}
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">登録済みの代表作</h2>
        {games.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            まだ登録されていません。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {games.map((g) => (
              <li key={g.universe_id} className="flex items-center gap-3 py-2 px-1">
                <div className="w-12 h-12 shrink-0 bg-muted overflow-hidden">
                  {g.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.thumbnail_url}
                      alt={g.name}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate flex items-center gap-1">
                    {g.is_primary ? (
                      <span className="text-[10px] border border-border px-1 py-0 leading-4 text-muted-foreground">
                        代表作
                      </span>
                    ) : null}
                    <span className="truncate">{g.name}</span>
                  </div>
                  {g.creator_name ? (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {g.creator_name}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-[11px] shrink-0">
                  {!g.is_primary ? (
                    <button
                      type="button"
                      onClick={() => setPrimary(g.universe_id)}
                      disabled={busyId === g.universe_id}
                      className="underline disabled:opacity-40"
                    >
                      代表作にする
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeGame(g.universe_id, g.name)}
                    disabled={busyId === g.universe_id}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
