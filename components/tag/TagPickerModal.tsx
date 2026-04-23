'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TagMaster } from '@/lib/tags';

/**
 * タグ投票モーダル（client）。
 *
 * 仕様：
 *  - 選択式のみ（自由入力なし、拡張ガイドライン MOD-01）
 *  - 最大5件まで同時選択・投稿
 *  - グループ別に表示
 *  - 送信後は closeし、成功件数だけ軽く通知
 *
 * 未ログイン時の誘導はフェーズ6後半で認証が入るまでは不要（匿名fingerprintで投票可）。
 */

const MAX_SELECT = 5;

export function TagPickerModal({
  universeId,
  tags,
}: {
  universeId: number;
  tags: TagMaster[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 公式＋ユーザー選択式、グループ別にまとめる
  const grouped = useMemo(() => {
    const order: TagMaster['tagGroup'][] = [
      'format',
      'difficulty',
      'reaction',
      'participation',
      'vibe',
      'caution',
    ];
    const map = new Map<TagMaster['tagGroup'], TagMaster[]>();
    for (const t of tags) {
      if (t.tagType === 'free') continue;
      const arr = map.get(t.tagGroup) ?? [];
      arr.push(t);
      map.set(t.tagGroup, arr);
    }
    return order
      .filter((g) => map.has(g))
      .map((g) => ({ group: g, tags: map.get(g)! }));
  }, [tags]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = (tagId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else if (next.size < MAX_SELECT) next.add(tagId);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/games/${universeId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: Array.from(selected) }),
      });
      if (res.status === 429) {
        setMessage('投票しすぎです。時間をあけて再度お試しください。');
        return;
      }
      if (!res.ok) {
        setMessage('投票に失敗しました。');
        return;
      }
      const json = (await res.json()) as {
        results: Array<{ tag_id: string; status: 'ok' | 'duplicate' }>;
      };
      const ok = json.results.filter((r) => r.status === 'ok').length;
      const dup = json.results.filter((r) => r.status === 'duplicate').length;
      setMessage(
        dup > 0
          ? `${ok}件反映しました（${dup}件は24時間以内に投票済み）`
          : `${ok}件反映しました。`
      );
      setSelected(new Set());
      // API側で revalidatePath 済み。router.refresh() でServer Componentを再取得し、
      // TagCloud が最新の得票数で描画される（スクロール位置・client stateは保持）。
      if (ok > 0) {
        router.refresh();
        setTimeout(() => setOpen(false), 800);
      }
    } catch (e) {
      console.error(e);
      setMessage('通信エラー');
    } finally {
      setSubmitting(false);
    }
  };

  const groupLabel: Record<TagMaster['tagGroup'], string> = {
    format: '遊び方',
    difficulty: '難易度・英語',
    reaction: 'リアクション',
    participation: '参加形式',
    vibe: '空気感',
    caution: '注意点',
    genre: 'ジャンル',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted"
      >
        タグを付ける
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="タグを付ける"
            className="bg-background w-full sm:max-w-lg max-h-[85vh] overflow-y-auto border border-border"
          >
            <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium">タグを付ける</div>
                <div className="text-[12px] text-muted-foreground">
                  最大 {MAX_SELECT} 件まで（{selected.size}/{MAX_SELECT}）
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[13px] px-2 py-1 hover:bg-muted"
                aria-label="閉じる"
              >
                閉じる
              </button>
            </div>

            <div className="p-4 space-y-4">
              {grouped.map(({ group, tags: gTags }) => (
                <div key={group}>
                  <div className="text-[12px] text-muted-foreground mb-1.5">
                    {groupLabel[group]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {gTags.map((t) => {
                      const on = selected.has(t.tagId);
                      const isOfficial = t.tagType === 'official';
                      const base =
                        'text-[12px] px-2 py-1 leading-none cursor-pointer select-none';
                      const style = on
                        ? 'bg-blue-600 text-white'
                        : isOfficial
                        ? 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                        : 'border border-foreground/40 text-foreground hover:bg-muted';
                      return (
                        <button
                          key={t.tagId}
                          type="button"
                          onClick={() => toggle(t.tagId)}
                          className={`${base} ${style}`}
                          title={t.description ?? undefined}
                        >
                          {t.tagName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex items-center gap-3">
              {message ? (
                <div className="text-[12px] text-muted-foreground flex-1">{message}</div>
              ) : (
                <div className="text-[12px] text-muted-foreground flex-1">
                  同じ印象のタグを選ぶと集計に反映されます。
                </div>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={selected.size === 0 || submitting}
                className="text-[13px] px-3 py-1.5 bg-foreground text-background disabled:opacity-40"
              >
                {submitting ? '送信中…' : 'タグを付ける'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
