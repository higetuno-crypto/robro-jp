'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * ヘッダー固定の検索ボックス。
 * Enter または送信ボタンで /search?q=... に遷移するだけ（オートコンプリートなし）。
 *
 * UI 原則：装飾は最小、ヘッダーの淡々としたトーンを崩さない。
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(() => params?.get('q') ?? '');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center w-full" role="search">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ゲーム名・開発者名で検索（Roblox 全体から）"
        aria-label="ゲーム検索"
        className="text-[13px] px-2 py-1 border border-border bg-background w-full outline-none focus:border-foreground"
        maxLength={100}
      />
    </form>
  );
}
