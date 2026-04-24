'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminGameTagRow } from './page';

/**
 * 特定ゲームに付いているタグの管理UI。
 *  - 票数の ±1 / ±5
 *  - 行削除（ユーザー投票を白紙に戻す）
 *  - 監査ログ（game_tag_vote_logs）は残す方針
 */
export function AdminGameTagsClient({
  universeId,
  initialTags,
}: {
  universeId: number;
  initialTags: AdminGameTagRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = async (tagId: string, delta: number) => {
    setBusy(tagId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/games/${universeId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId, delta }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? '失敗');
        return;
      }
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('通信エラー');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (tagId: string, tagName: string) => {
    if (!confirm(`「${tagName}」をこのゲームから外しますか？（投票数ゼロに）`)) return;
    setBusy(tagId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/games/${universeId}/tags?tag_id=${encodeURIComponent(tagId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? '失敗');
        return;
      }
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('通信エラー');
    } finally {
      setBusy(null);
    }
  };

  if (initialTags.length === 0) {
    return (
      <p className="text-muted-foreground text-[13px]">
        このゲームにはまだタグの投票がありません。
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-[14px] font-semibold">付与タグ一覧（{initialTags.length}件）</h3>
      {error && <div className="text-[12px] text-red-600">{error}</div>}
      <ul className="divide-y divide-border border border-border">
        {initialTags.map((t) => {
          const isBusy = busy === t.tagId;
          return (
            <li key={t.tagId} className="px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[13px]">
                  {t.tagName}
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    {t.tagType === 'official' ? '公式' : 'ユーザー'} / {t.tagGroup}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  tag_id: <code>{t.tagId}</code>
                  {' / '}conf: {t.confidenceScore.toFixed(2)}
                  {t.lastVotedAt && (
                    <>
                      {' / '}最終: {new Date(t.lastVotedAt).toLocaleString('ja-JP')}
                    </>
                  )}
                </div>
              </div>
              <div className="text-[14px] tabular-nums w-10 text-right">
                {t.voteCount}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => patch(t.tagId, -1)}
                  className="px-2 py-0.5 text-[12px] border border-border hover:bg-muted disabled:opacity-40"
                  title="-1"
                >
                  −1
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => patch(t.tagId, -5)}
                  className="px-2 py-0.5 text-[12px] border border-border hover:bg-muted disabled:opacity-40"
                  title="-5"
                >
                  −5
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => patch(t.tagId, 1)}
                  className="px-2 py-0.5 text-[12px] border border-border hover:bg-muted disabled:opacity-40"
                  title="+1"
                >
                  +1
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => remove(t.tagId, t.tagName)}
                  className="px-2 py-0.5 text-[12px] border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  削除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        ±1/±5 で票数を増減、削除は行ごと消去。監査ログ（game_tag_vote_logs）は保持されます。
      </p>
    </section>
  );
}
