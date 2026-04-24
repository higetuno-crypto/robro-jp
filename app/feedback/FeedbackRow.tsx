'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackPost,
} from '@/lib/feedback';
import { formatRelativeJa } from '@/lib/format';

interface Props {
  post: FeedbackPost;
  voted: boolean;
  canVote: boolean;
}

export function FeedbackRow({ post, voted: initialVoted, canVote }: Props) {
  const router = useRouter();
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(post.voteCount);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const status = FEEDBACK_STATUSES.find((s) => s.key === post.status);
  const category = FEEDBACK_CATEGORIES.find((c) => c.key === post.category);

  const bodyIsLong = post.body.length > 120;
  const bodyPreview = expanded || !bodyIsLong
    ? post.body
    : post.body.slice(0, 120) + '…';

  async function handleVote() {
    if (!canVote || busy) return;
    setBusy(true);
    // 楽観更新
    const nextVoted = !voted;
    setVoted(nextVoted);
    setCount((c) => c + (nextVoted ? 1 : -1));
    try {
      const res = await fetch(`/api/feedback/${post.id}/vote`, { method: 'POST' });
      if (!res.ok) {
        // ロールバック
        setVoted(!nextVoted);
        setCount((c) => c + (nextVoted ? -1 : 1));
        if (res.status === 401) alert('ログインが必要です');
      } else {
        const data = (await res.json()) as { voted: boolean; voteCount: number };
        setVoted(data.voted);
        setCount(data.voteCount);
        router.refresh();
      }
    } catch (e) {
      setVoted(!nextVoted);
      setCount((c) => c + (nextVoted ? -1 : 1));
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3 items-start px-3 py-3 border-b border-border last:border-b-0">
      {/* 投票ボタン */}
      <button
        type="button"
        onClick={handleVote}
        disabled={!canVote || busy}
        className={
          'flex flex-col items-center justify-center w-12 py-1 border text-[12px] shrink-0 ' +
          (voted
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-card hover:bg-muted/40') +
          (!canVote ? ' opacity-60 cursor-not-allowed' : '')
        }
        aria-label={voted ? '投票を取り消す' : '投票する'}
        title={canVote ? (voted ? '投票済み（クリックで取消）' : '投票する') : 'ログインが必要です'}
      >
        <span aria-hidden className="text-[14px] leading-none">▲</span>
        <span className="tabular-nums font-medium leading-tight mt-[2px]">{count}</span>
      </button>

      {/* 本文 */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline mb-1">
          <h3 className="text-[14px] font-medium leading-tight break-words">
            {post.title}
          </h3>
          {status && (
            <span className={'text-[11px] ' + status.tone}>
              [{status.label}]
            </span>
          )}
          {category && (
            <span className="text-[11px] text-muted-foreground">
              {category.label}
            </span>
          )}
        </div>
        <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
          {bodyPreview}
          {bodyIsLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-2 text-[12px] text-muted-foreground hover:underline"
            >
              {expanded ? '折りたたむ' : 'もっと見る'}
            </button>
          )}
        </p>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {post.authorName ?? 'ゲスト'} ・ {formatRelativeJa(post.createdAt)}
        </div>
      </div>
    </div>
  );
}
