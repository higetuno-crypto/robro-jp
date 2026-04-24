'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * トップ上部の「ようこそストリップ」。
 * robro-jp の3つの顔（プレイヤー／配信者／コミュニティ）に対応する目的別エントリ。
 *
 * UI原則：
 * - ランキング行の淡々トーンは壊さない前提で、ヘッダー直下に小さめに配置
 * - 閉じるボタンで localStorage 記憶（リピーターには邪魔にならない）
 * - カードは1行3枚、アイコン + タイトル1行 + 補足1行のみ
 */

const DISMISS_KEY = 'robrojp.welcomeStrip.dismissed.v1';

interface Entry {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}

const ENTRIES: Entry[] = [
  {
    href: '/guide',
    icon: '🔰',
    title: '初めての方はこちら',
    subtitle: 'サイトの使い方・アカウントの作り方',
  },
  {
    href: '/stream',
    icon: '🎬',
    title: '配信ネタを探している方',
    subtitle: '用途別に配信向きゲームを発見',
  },
  {
    href: '/feedback',
    icon: '💬',
    title: 'サイトを良くしたい方',
    subtitle: 'ご意見・要望・投票',
  },
];

export function WelcomeStrip() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined'
      && window.localStorage.getItem(DISMISS_KEY) === '1';
    setHidden(dismissed);
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  return (
    <div className="border-b border-border px-3 py-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[13px] font-medium">ようこそ</div>
        <button
          type="button"
          onClick={dismiss}
          className="text-[12px] text-muted-foreground hover:underline"
          aria-label="ようこそストリップを閉じる"
        >
          閉じる
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="flex items-start gap-2 border border-border bg-card hover:bg-muted/40 px-3 py-2"
          >
            <span className="text-[18px] leading-none pt-[1px]" aria-hidden>
              {e.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium leading-tight">
                {e.title}
              </span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {e.subtitle}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
