'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 右下固定のご意見FAB（Floating Action Button）。
 *
 * 表示条件：
 *  - /feedback 配下（自己参照）では非表示
 *  - /admin 配下（管理画面を汚さない）では非表示
 *  - 閉じるボタンで30日間非表示（localStorage 記憶）
 *
 * UI原則：ランキング行の独立レイヤーとして、行デザインには触れない。
 */

const DISMISS_KEY = 'robrojp.feedbackFab.dismissedAt.v1';
const DISMISS_DURATION_MS = 30 * 24 * 3600 * 1000; // 30日

export function FeedbackFab() {
  const pathname = usePathname() ?? '';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const dismissedAt = raw ? Number(raw) : 0;
    const isDismissed =
      Number.isFinite(dismissedAt) &&
      dismissedAt > 0 &&
      Date.now() - dismissedAt < DISMISS_DURATION_MS;
    setVisible(!isDismissed);
  }, []);

  // 自己参照・管理画面では非表示
  const isExcludedPath =
    pathname.startsWith('/feedback') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login');

  if (!visible || isExcludedPath) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1">
      <Link
        href="/feedback"
        className="group flex items-center gap-2 bg-foreground text-background border border-foreground shadow-sm px-3 py-2 text-[13px] hover:opacity-90"
        aria-label="ご意見・要望を送る"
      >
        <span aria-hidden className="text-[14px] leading-none">💬</span>
        <span className="hidden sm:inline">ご意見・要望</span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        className="bg-background border border-border text-muted-foreground hover:text-foreground px-1.5 py-1 text-[11px] leading-none shadow-sm"
        aria-label="ご意見ボタンを30日間非表示にする"
        title="30日間非表示"
      >
        ×
      </button>
    </div>
  );
}
