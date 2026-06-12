'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AdminTipRow, TipStatus } from './page';
import type { StrategyTipCategory } from '@/lib/strategy-tips';

/**
 * 攻略Tips モデレーション・クライアント。
 * 各アクションは PATCH /api/admin/strategy-tips/[tipId]（middleware Basic 認証下）。
 */

type Action = 'hide' | 'remove' | 'restore' | 'dismiss_reports';

const REASON_LABEL: Record<string, string> = {
  spam: 'スパム・宣伝',
  offensive: '不適切・攻撃的',
  wrong_info: '誤った情報',
  offtopic: '無関係',
  other: 'その他',
};

const STATUS_LABEL: Record<TipStatus, string> = {
  published: '公開中',
  hidden: '非表示',
  removed: '削除済み',
};

const STATUS_TONE: Record<TipStatus, string> = {
  published: 'text-green-700',
  hidden: 'text-amber-700',
  removed: 'text-red-600',
};

type FilterKey = 'queue' | 'hidden' | 'removed' | 'all';

export function AdminStrategyTipsClient({
  initialRows,
  categories,
}: {
  initialRows: AdminTipRow[];
  categories: ReadonlyArray<{ key: StrategyTipCategory; label: string }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<FilterKey>('queue');
  const [busy, setBusy] = useState<number | null>(null);

  const catLabel = (k: StrategyTipCategory) =>
    categories.find((c) => c.key === k)?.label ?? k;

  const counts = {
    queue: rows.filter((r) => r.openReports.length > 0).length,
    hidden: rows.filter((r) => r.status === 'hidden').length,
    removed: rows.filter((r) => r.status === 'removed').length,
    all: rows.length,
  };

  const shown = rows.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'queue'
        ? r.openReports.length > 0
        : r.status === filter
  );

  async function act(tipId: number, action: Action) {
    if (action === 'remove' && !confirm('このTipを削除（removed）します。よろしいですか？')) {
      return;
    }
    setBusy(tipId);
    try {
      const res = await fetch(`/api/admin/strategy-tips/${tipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        alert('更新に失敗しました');
        return;
      }
      const json = (await res.json()) as { status: TipStatus };
      // published に戻った Tip（restore / dismiss_reports）はキュー対象外 → 一覧から落とす。
      // hide / remove は status を更新して残す（非表示/削除済みフィルタで見える）。
      setRows((prev) =>
        json.status === 'published'
          ? prev.filter((r) => r.tipId !== tipId)
          : prev.map((r) =>
              r.tipId === tipId ? { ...r, status: json.status, openReports: [] } : r
            )
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="text-[13px] text-muted-foreground">
        即時公開＋事後モデレーション。通報5件で自動「非表示」に退避されます。ここで内容を確認し、
        <strong>公開に戻す／非表示／削除</strong>、または<strong>通報を却下</strong>してください。
      </div>

      <div className="flex flex-wrap items-baseline gap-3 text-[13px]">
        <span className="text-muted-foreground">表示:</span>
        <FilterBtn active={filter === 'queue'} onClick={() => setFilter('queue')}>
          通報キュー（{counts.queue}）
        </FilterBtn>
        <FilterBtn active={filter === 'hidden'} onClick={() => setFilter('hidden')}>
          非表示（{counts.hidden}）
        </FilterBtn>
        <FilterBtn active={filter === 'removed'} onClick={() => setFilter('removed')}>
          削除済み（{counts.removed}）
        </FilterBtn>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
          すべて（{counts.all}）
        </FilterBtn>
        <span className="ml-auto text-[12px] text-muted-foreground">{shown.length} 件</span>
      </div>

      <div className="border border-border">
        {shown.length === 0 ? (
          <div className="px-3 py-8 text-[13px] text-muted-foreground text-center">
            対応が必要な攻略Tipsはありません。
          </div>
        ) : (
          shown.map((r) => (
            <div
              key={r.tipId}
              className="px-3 py-3 border-b border-border last:border-b-0 space-y-2"
            >
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                <span className="text-[11px] text-muted-foreground">#{r.tipId}</span>
                <span className="inline-block bg-foreground/10 px-1.5 py-0.5 text-[11px] leading-none">
                  {catLabel(r.category)}
                </span>
                <span className={`text-[11px] font-medium ${STATUS_TONE[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  👍{r.helpfulCount}
                </span>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  通報{r.reportCount}
                  {r.openReports.length > 0 && (
                    <span className="text-red-600">（未処理{r.openReports.length}）</span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {r.isMemberAuthor ? '会員' : '匿名'}
                </span>
                <Link
                  href={`/game/${r.universeId}`}
                  className="text-[11px] text-muted-foreground underline ml-auto break-all"
                >
                  {r.gameName ?? `universe ${r.universeId}`} →
                </Link>
              </div>

              <p className="text-[13px] whitespace-pre-wrap break-words text-foreground/90">
                {r.bodyJa}
              </p>

              <div className="text-[11px] text-muted-foreground">
                投稿: {new Date(r.createdAt).toLocaleString('ja-JP')}
              </div>

              {r.openReports.length > 0 && (
                <div className="bg-red-50 border border-red-100 px-2 py-1.5 space-y-1">
                  <div className="text-[11px] font-medium text-red-700">
                    未処理の通報 {r.openReports.length} 件
                  </div>
                  <ul className="space-y-0.5">
                    {r.openReports.map((rep) => (
                      <li key={rep.id} className="text-[11px] text-foreground/80">
                        <span className="font-medium">
                          {REASON_LABEL[rep.reason] ?? rep.reason}
                        </span>
                        {rep.detail ? `：${rep.detail}` : ''}
                        <span className="text-muted-foreground">
                          {' '}
                          / {new Date(rep.createdAt).toLocaleString('ja-JP')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center pt-1">
                {(r.status === 'hidden' || r.status === 'removed') && (
                  <ActionBtn
                    disabled={busy === r.tipId}
                    onClick={() => act(r.tipId, 'restore')}
                  >
                    公開に戻す
                  </ActionBtn>
                )}
                {r.status === 'published' && (
                  <ActionBtn
                    disabled={busy === r.tipId}
                    onClick={() => act(r.tipId, 'hide')}
                  >
                    非表示にする
                  </ActionBtn>
                )}
                {r.status === 'published' && r.openReports.length > 0 && (
                  <ActionBtn
                    disabled={busy === r.tipId}
                    onClick={() => act(r.tipId, 'dismiss_reports')}
                  >
                    通報を却下（問題なし）
                  </ActionBtn>
                )}
                {r.status !== 'removed' && (
                  <ActionBtn
                    disabled={busy === r.tipId}
                    danger
                    onClick={() => act(r.tipId, 'remove')}
                  >
                    削除
                  </ActionBtn>
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

function ActionBtn({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'px-2 py-1 text-[12px] border disabled:opacity-40',
        danger
          ? 'border-red-300 text-red-700 hover:bg-red-50'
          : 'border-border bg-card hover:bg-muted/40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
