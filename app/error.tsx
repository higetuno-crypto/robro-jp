'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * 全ルート共通のランタイムエラーページ。
 * UI トーン：ランキング側の淡々と寄せて、再試行と主導線だけ提供する。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="max-w-3xl mx-auto px-3 py-10 space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold">ページの読み込みでエラーが発生しました</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          一時的な問題の可能性があります。少し時間を置いて再試行してください。
        </p>
        {error.digest && (
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            ID: {error.digest}
          </p>
        )}
      </header>
      <div className="flex flex-wrap gap-3 text-[14px]">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-foreground text-background hover:opacity-90"
        >
          再試行
        </button>
        <Link href="/" className="px-4 py-2 border border-border hover:bg-muted">
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
