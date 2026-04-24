'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/lib/feedback';

const MIN_TITLE = 5;
const MAX_TITLE = 80;
const MIN_BODY = 10;
const MAX_BODY = 2000;

export function FeedbackComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleLen = title.length;
  const bodyLen = body.length;
  const titleOk = titleLen >= MIN_TITLE && titleLen <= MAX_TITLE;
  const bodyOk = bodyLen >= MIN_BODY && bodyLen <= MAX_BODY;
  const canSubmit = titleOk && bodyOk && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError('ログインが必要です');
        } else if (res.status === 422 && data?.error === 'moderation_block') {
          setError('利用できない表現が含まれています。言い回しを見直してください。');
        } else if (res.status === 429) {
          setError('投稿間隔が短すぎます。しばらく待ってから再度お試しください（1分1件・1日3件まで）。');
        } else {
          setError('投稿に失敗しました。時間をおいて再度お試しください。');
        }
        return;
      }
      setTitle('');
      setBody('');
      setCategory('idea');
      setOpen(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('通信エラーが発生しました。');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left border border-border bg-card hover:bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground"
      >
        ＋ 新しいご意見・要望を投稿する
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border bg-card p-3 space-y-3"
    >
      <div>
        <label className="block text-[12px] text-muted-foreground mb-1">
          タイトル <span className="tabular-nums">({titleLen}/{MAX_TITLE})</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE}
          placeholder="簡潔に（例: 検索ボックスがほしい）"
          className="w-full border border-border px-2 py-1 text-[14px] bg-background"
        />
      </div>

      <div>
        <label className="block text-[12px] text-muted-foreground mb-1">
          種別
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          className="border border-border px-2 py-1 text-[13px] bg-background"
        >
          {FEEDBACK_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[12px] text-muted-foreground mb-1">
          本文 <span className="tabular-nums">({bodyLen}/{MAX_BODY})</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY}
          rows={6}
          placeholder="どんな場面で困ったか・どうなると嬉しいかを具体的に書くと投票が集まりやすくなります。"
          className="w-full border border-border px-2 py-1 text-[13px] bg-background leading-relaxed"
        />
      </div>

      {error && (
        <div className="text-[12px] text-red-600">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="border border-primary bg-primary text-primary-foreground px-3 py-1 text-[13px] disabled:opacity-60"
        >
          {busy ? '送信中…' : '投稿する'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-[12px] text-muted-foreground hover:underline"
        >
          キャンセル
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          投稿は公開されます（表示名も一緒に出ます）
        </span>
      </div>
    </form>
  );
}
