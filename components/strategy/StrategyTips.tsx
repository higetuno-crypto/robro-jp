'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StrategyTip, StrategyTipCategory } from '@/lib/strategy-tips';
import { formatRelativeJa } from '@/lib/format';

/**
 * 攻略Tips（集合知型UGC）セクション。`/game/[universeId]` に同居。
 * 仕様：higesakusei/新しい方向性/攻略Tips-MVP設計.md
 *
 *  - 匿名でも投稿できる（ログイン不要）。一覧は👍降順
 *  - 👍投票（楽観更新）／通報（事後モデレーション）
 *  - 構造化された短文Tips（白紙の長文wikiにしない＝投稿障壁を下げる）
 *  - 近接表記：Roblox 公式の攻略ではない旨を明示（必須UI表記）
 *
 * カテゴリ・文字数は lib/strategy-tips.ts と一致させる（フォーム表示用にここで保持）。
 */

const CATEGORIES: ReadonlyArray<{ key: StrategyTipCategory; label: string }> = [
  { key: 'early', label: '序盤の進め方' },
  { key: 'earn', label: '稼ぎ方・効率' },
  { key: 'boss', label: 'ボス・強敵' },
  { key: 'trick', label: '裏技・小技' },
  { key: 'glossary', label: '用語' },
  { key: 'controls', label: '操作のコツ' },
  { key: 'other', label: 'その他' },
];
const CATEGORY_LABEL: Record<StrategyTipCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
) as Record<StrategyTipCategory, string>;

const REPORT_REASONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'spam', label: 'スパム・宣伝' },
  { key: 'offensive', label: '不適切・攻撃的' },
  { key: 'wrong_info', label: '誤った情報' },
  { key: 'offtopic', label: '無関係' },
  { key: 'other', label: 'その他' },
];

const BODY_MIN = 10;
const BODY_MAX = 300;

export function StrategyTips({
  universeId,
  initialTips,
}: {
  universeId: number;
  initialTips: StrategyTip[];
}) {
  const router = useRouter();
  const [tips, setTips] = useState<StrategyTip[]>(initialTips);
  const [filter, setFilter] = useState<StrategyTipCategory | 'all'>('all');
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [votingId, setVotingId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 投稿モーダル
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<StrategyTipCategory>('early');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const presentCategories = useMemo(() => {
    const set = new Set(tips.map((t) => t.category));
    return CATEGORIES.filter((c) => set.has(c.key));
  }, [tips]);

  const shown = useMemo(
    () => (filter === 'all' ? tips : tips.filter((t) => t.category === filter)),
    [tips, filter]
  );

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  async function vote(tipId: number) {
    if (voted.has(tipId) || votingId !== null) return;
    setVotingId(tipId);
    // 楽観更新
    setTips((ts) =>
      ts.map((t) => (t.tipId === tipId ? { ...t, helpfulCount: t.helpfulCount + 1 } : t))
    );
    setVoted((v) => new Set(v).add(tipId));
    try {
      const res = await fetch(
        `/api/games/${universeId}/strategy-tips/${tipId}/vote`,
        { method: 'POST' }
      );
      if (!res.ok) {
        // ロールバック
        setTips((ts) =>
          ts.map((t) =>
            t.tipId === tipId ? { ...t, helpfulCount: Math.max(0, t.helpfulCount - 1) } : t
          )
        );
        setVoted((v) => {
          const n = new Set(v);
          n.delete(tipId);
          return n;
        });
        if (res.status === 429) flash('投票が多すぎます。少し時間をあけてください。');
        else flash('投票に失敗しました。');
        return;
      }
      const json = (await res.json()) as { helpful_count: number; duplicate: boolean };
      // サーバーの確定値に合わせる（duplicate の場合も真の件数に）
      setTips((ts) =>
        ts.map((t) => (t.tipId === tipId ? { ...t, helpfulCount: json.helpful_count } : t))
      );
    } catch {
      flash('通信エラー。');
    } finally {
      setVotingId(null);
    }
  }

  async function report(tipId: number, reason: string) {
    setReportingId(null);
    try {
      const res = await fetch(
        `/api/games/${universeId}/strategy-tips/${tipId}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );
      if (res.status === 429) {
        flash('通報が多すぎます。時間をあけてください。');
        return;
      }
      flash('通報しました。確認します。');
    } catch {
      flash('通信エラー。');
    }
  }

  async function submit() {
    const text = body.trim();
    if (text.length < BODY_MIN || text.length > BODY_MAX || submitting) return;
    setSubmitting(true);
    setFormMessage(null);
    try {
      const res = await fetch(`/api/games/${universeId}/strategy-tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, body: text }),
      });
      if (res.status === 422) {
        const j = (await res.json()) as {
          issues?: Array<{ severity: string; word: string; suggestion?: string }>;
        };
        const blocked = (j.issues ?? [])
          .filter((i) => i.severity === 'block')
          .map((i) => i.word);
        setFormMessage(
          blocked.length > 0
            ? `使用できない表現が含まれています：${blocked.join('、')}`
            : '内容を確認してください。'
        );
        return;
      }
      if (res.status === 429) {
        setFormMessage('投稿が多すぎます。時間をあけて再度お試しください。');
        return;
      }
      if (!res.ok) {
        setFormMessage('投稿に失敗しました。');
        return;
      }
      const json = (await res.json()) as { tip: StrategyTip };
      // 楽観的に先頭へ追加（API側で revalidate 済み）
      setTips((ts) => [json.tip, ...ts]);
      setBody('');
      setFormMessage(null);
      setOpen(false);
      flash('投稿しました。ありがとうございます！');
      router.refresh();
    } catch {
      setFormMessage('通信エラー。');
    } finally {
      setSubmitting(false);
    }
  }

  const len = body.trim().length;
  const lenOk = len >= BODY_MIN && len <= BODY_MAX;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[14px] font-medium">みんなの攻略・コツ</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted"
        >
          コツを書く
        </button>
      </div>

      {/* 必須UI表記：Roblox 公式の攻略ではない */}
      <p className="text-[11px] text-muted-foreground leading-snug mb-3">
        ここはユーザーが投稿した攻略・コツです。Roblox 公式の情報・攻略ではなく、内容の正確性は保証されません。ログインなしでも投稿・👍できます。
      </p>

      {/* カテゴリフィルタ（Tipsが付いているカテゴリのみ） */}
      {presentCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            すべて
          </FilterChip>
          {presentCategories.map((c) => (
            <FilterChip
              key={c.key}
              active={filter === c.key}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </FilterChip>
          ))}
        </div>
      )}

      {/* 一覧 / 空状態 */}
      {shown.length === 0 ? (
        <div className="text-[13px] text-muted-foreground border border-dashed border-border px-3 py-6 text-center">
          {tips.length === 0 ? (
            <>
              まだ攻略・コツがありません。
              <br />
              このゲームを遊んだ人として、最初の1件を書いてみませんか？
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted"
                >
                  最初のコツを書く
                </button>
              </div>
            </>
          ) : (
            'このカテゴリの投稿はまだありません。'
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => {
            const hasVoted = voted.has(t.tipId);
            return (
              <li key={t.tipId} className="border border-border px-3 py-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted-foreground mb-1">
                      <span className="inline-block bg-foreground/10 px-1.5 py-0.5 leading-none mr-2">
                        {CATEGORY_LABEL[t.category]}
                      </span>
                      <span>{t.isMemberAuthor ? '会員' : '匿名'}</span>
                      <span className="mx-1">・</span>
                      <span>{formatRelativeJa(t.createdAt)}</span>
                    </div>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                      {t.bodyJa}
                    </p>
                    <div className="mt-1.5">
                      {reportingId === t.tipId ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">理由：</span>
                          {REPORT_REASONS.map((r) => (
                            <button
                              key={r.key}
                              type="button"
                              onClick={() => report(t.tipId, r.key)}
                              className="px-1.5 py-0.5 border border-border hover:bg-muted leading-none"
                            >
                              {r.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setReportingId(null)}
                            className="px-1.5 py-0.5 text-muted-foreground hover:underline leading-none"
                          >
                            やめる
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReportingId(t.tipId)}
                          className="text-[11px] text-muted-foreground hover:underline"
                        >
                          通報
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 👍 */}
                  <button
                    type="button"
                    onClick={() => vote(t.tipId)}
                    disabled={hasVoted || votingId !== null}
                    aria-pressed={hasVoted}
                    title="役に立った"
                    className={[
                      'shrink-0 flex flex-col items-center justify-center gap-0.5 border px-2.5 py-1.5 min-w-[52px]',
                      'text-[13px] tabular-nums select-none',
                      hasVoted
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-border hover:bg-muted',
                      votingId !== null ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <span aria-hidden="true">👍</span>
                    <span className="font-medium">{t.helpfulCount.toLocaleString('ja-JP')}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notice && (
        <div role="status" aria-live="polite" className="mt-2 text-[12px] text-muted-foreground">
          {notice}
        </div>
      )}

      {/* 投稿モーダル */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="攻略・コツを書く"
            className="bg-background w-full sm:max-w-lg max-h-[85vh] overflow-y-auto border border-border"
          >
            <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="text-[14px] font-medium">攻略・コツを書く</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[13px] px-2 py-1 hover:bg-muted"
                aria-label="閉じる"
              >
                閉じる
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="text-[12px] text-muted-foreground mb-1.5">カテゴリ</div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={[
                        'text-[12px] px-2 py-1 leading-none',
                        category === c.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-foreground/10 text-foreground hover:bg-foreground/20',
                      ].join(' ')}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-1.5">
                  <span>本文（{BODY_MIN}〜{BODY_MAX}字）</span>
                  <span className={lenOk || len === 0 ? '' : 'text-red-600'}>
                    {len}/{BODY_MAX}
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={BODY_MAX + 50}
                  placeholder="例：序盤は南の小屋で木を集めてから武器を作ると安定します"
                  className="w-full border border-border px-2 py-1.5 text-[14px] leading-relaxed resize-y"
                />
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  Roblox の説明文の転載・翻訳ではなく、自分の言葉で書いてください。誹謗中傷・宣伝は禁止です。
                </p>
              </div>

              {formMessage && (
                <div className="text-[12px] text-red-600">{formMessage}</div>
              )}
            </div>

            <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={!lenOk || submitting}
                className="text-[13px] px-3 py-1.5 bg-foreground text-background disabled:opacity-40"
              >
                {submitting ? '送信中…' : '投稿する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
      className={[
        'text-[12px] px-2 py-1 leading-none border',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background text-foreground border-border hover:bg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
