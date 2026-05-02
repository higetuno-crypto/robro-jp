'use client';

import { useState } from 'react';

interface Props {
  targetType: 'game' | 'creator' | 'tag';
  targetId: number;
  className?: string;
}

export function ReportButton({ targetType, targetId, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/moderation/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setError('通報にはログインが必要です。');
        } else if (data?.error === 'duplicate_report_within_24h') {
          setError('このコンテンツへの通報は24時間に1回までです。');
        } else if (data?.error === 'rate_limit_exceeded') {
          setError('短時間に通報が多すぎます。少し時間をあけてから再度お試しください。');
        } else {
          setError('通報の送信に失敗しました。');
        }
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'text-[11px] text-muted-foreground hover:text-foreground underline'
        }
        title="このコンテンツを通報"
      >
        通報
      </button>
      {open ? (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-3"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border border-border max-w-md w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <>
                <h2 className="text-[14px] font-semibold">通報を受け付けました</h2>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  ご協力ありがとうございます。運営が内容を確認します。
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted"
                >
                  閉じる
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h2 className="text-[14px] font-semibold">コンテンツを通報</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  規約違反・なりすまし・不適切表現などを通報できます。
                  3件以上の通報で運営の確認対象になります。
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                  maxLength={500}
                  rows={4}
                  placeholder="どこが問題か具体的に書いてください（5〜500文字）"
                  className="mt-3 w-full px-2 py-1.5 text-[13px] border border-border bg-background"
                />
                <div className="mt-1 text-[10px] text-muted-foreground text-right">
                  {reason.length} / 500
                </div>
                {error ? (
                  <div className="mt-2 text-[12px] text-red-700 dark:text-red-300">{error}</div>
                ) : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted disabled:opacity-40"
                  >
                    {submitting ? '送信中…' : '通報する'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
