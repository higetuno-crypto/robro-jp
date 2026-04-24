'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminFeedbackRow } from './page';
import type { FeedbackStatus, FeedbackCategory } from '@/lib/feedback';

interface Props {
  initialRows: AdminFeedbackRow[];
  statuses: { key: FeedbackStatus; label: string; tone: string }[];
  categories: { key: FeedbackCategory; label: string }[];
}

export function AdminFeedbackClient({ initialRows, statuses, categories }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('visible');
  const [busy, setBusy] = useState<number | null>(null);

  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'hidden' ? r.isHidden : !r.isHidden
  );

  async function patch(id: number, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        alert('更新に失敗しました');
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                ...(typeof body.status === 'string' ? { status: body.status as FeedbackStatus } : {}),
                ...(typeof body.is_hidden === 'boolean' ? { isHidden: body.is_hidden } : {}),
                ...('duplicate_of' in body
                  ? { duplicateOf: body.duplicate_of as number | null }
                  : {}),
              }
            : r
        )
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 text-[13px]">
        <span className="text-muted-foreground">表示:</span>
        <FilterBtn active={filter === 'visible'} onClick={() => setFilter('visible')}>
          公開中
        </FilterBtn>
        <FilterBtn active={filter === 'hidden'} onClick={() => setFilter('hidden')}>
          非表示
        </FilterBtn>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
          すべて
        </FilterBtn>
        <span className="ml-auto text-[12px] text-muted-foreground">
          {visible.length} 件
        </span>
      </div>

      <div className="border border-border">
        {visible.length === 0 ? (
          <div className="px-3 py-6 text-[13px] text-muted-foreground text-center">
            該当する投稿はありません。
          </div>
        ) : (
          visible.map((r) => (
            <div
              key={r.id}
              className="px-3 py-3 border-b border-border last:border-b-0 space-y-2"
            >
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                <span className="text-[11px] text-muted-foreground">#{r.id}</span>
                <h3 className="text-[14px] font-medium break-words">{r.title}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {categories.find((c) => c.key === r.category)?.label}
                </span>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  ▲{r.voteCount}
                </span>
                {r.isHidden && (
                  <span className="text-[11px] text-red-600">[非表示]</span>
                )}
              </div>
              <p className="text-[13px] whitespace-pre-wrap break-words text-foreground/90">
                {r.body}
              </p>
              <div className="text-[11px] text-muted-foreground">
                {r.authorName ?? 'ゲスト'} ・{' '}
                {new Date(r.createdAt).toLocaleString('ja-JP')}
              </div>

              <div className="flex flex-wrap gap-2 items-center pt-1">
                <label className="text-[12px] text-muted-foreground">状態:</label>
                <select
                  value={r.status}
                  disabled={busy === r.id}
                  onChange={(e) => patch(r.id, { status: e.target.value })}
                  className="border border-border px-2 py-1 text-[12px] bg-background"
                >
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => patch(r.id, { is_hidden: !r.isHidden })}
                  className="border border-border bg-card hover:bg-muted/40 px-2 py-1 text-[12px]"
                >
                  {r.isHidden ? '公開に戻す' : '非表示にする'}
                </button>

                {r.status === 'duplicate' && (
                  <DuplicateOfEditor
                    row={r}
                    onSave={(dupId) => patch(r.id, { duplicate_of: dupId })}
                    busy={busy === r.id}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'font-medium underline underline-offset-2'
          : 'text-muted-foreground hover:underline'
      }
    >
      {children}
    </button>
  );
}

function DuplicateOfEditor({
  row,
  onSave,
  busy,
}: {
  row: AdminFeedbackRow;
  onSave: (id: number | null) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState(row.duplicateOf?.toString() ?? '');
  return (
    <span className="flex items-center gap-1">
      <label className="text-[12px] text-muted-foreground">重複先ID:</label>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="post id"
        className="w-20 border border-border px-1 py-0.5 text-[12px] bg-background"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const n = Number(value);
          onSave(value === '' ? null : Number.isFinite(n) && n > 0 ? n : null);
        }}
        className="border border-border bg-card hover:bg-muted/40 px-2 py-0.5 text-[12px]"
      >
        保存
      </button>
    </span>
  );
}
