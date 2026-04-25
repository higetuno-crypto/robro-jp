'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseClientClient } from '@/lib/supabase-browser';

/**
 * フェーズ8：3ボタン投票UI（❤️好き / ⭐お気に入り / 🔥頼むから人来て）
 *
 * 上位文書：feature-spec.md §3, idea-evaluation-v3.md §9
 *
 * 仕様：
 *  - ログイン必須。未ログイン時はログインモーダルへ誘導
 *  - 楽観的UI更新：押下→即座にカウント反映→失敗時ロールバック
 *  - 24h以内の同一ボタン再押下で取り消し（vote_value=-1）
 *  - 押下中は連打防止
 */

type ButtonType = 'like' | 'save' | 'recommend';

interface ButtonState {
  count: number;
  voted: boolean;
}

const BUTTONS: Array<{
  key: ButtonType;
  emoji: string;
  label: string;
  hint: string;
}> = [
  { key: 'like', emoji: '❤️', label: '好き', hint: '好きなゲームに' },
  { key: 'save', emoji: '⭐', label: 'お気に入り', hint: 'マイリストに追加' },
  { key: 'recommend', emoji: '🔥', label: '頼むから人来て', hint: '頼むから人来てほしい' },
];

export function VoteButtons({
  universeId,
  initial,
}: {
  universeId: number;
  initial?: {
    like?: ButtonState;
    save?: ButtonState;
    recommend?: ButtonState;
  };
}) {
  const pathname = usePathname();
  const [state, setState] = useState<Record<ButtonType, ButtonState>>({
    like: initial?.like ?? { count: 0, voted: false },
    save: initial?.save ?? { count: 0, voted: false },
    recommend: initial?.recommend ?? { count: 0, voted: false },
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<ButtonType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 認証状態とユーザー本人の投票状態を取得
  useEffect(() => {
    const supabase = createSupabaseClientClient();
    let mounted = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      const loggedIn = !!data.user;
      setIsLoggedIn(loggedIn);

      // initial が無い、または未ログインなら投票状態は問い合わせない
      if (!loggedIn) return;
      try {
        const res = await fetch(`/api/games/${universeId}/votes`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!mounted) return;
        setState({
          like: { count: body.like.count, voted: body.like.user_voted },
          save: { count: body.save.count, voted: body.save.user_voted },
          recommend: { count: body.recommend.count, voted: body.recommend.user_voted },
        });
      } catch {
        // noop
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (mounted) setIsLoggedIn(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [universeId]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleClick(buttonType: ButtonType) {
    if (busy) return;
    if (isLoggedIn === false) {
      const next = encodeURIComponent(pathname ?? '/');
      window.location.href = `/login?next=${next}`;
      return;
    }
    if (isLoggedIn === null) return; // 認証状態取得待ち

    const prev = state[buttonType];
    const action = prev.voted ? 'remove' : 'add';
    const optimisticDelta = action === 'add' ? 1 : -1;

    // 楽観的更新
    setState((s) => ({
      ...s,
      [buttonType]: { count: Math.max(0, s[buttonType].count + optimisticDelta), voted: !prev.voted },
    }));
    setBusy(buttonType);

    try {
      const res = await fetch(`/api/games/${universeId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ button_type: buttonType, action }),
      });

      if (!res.ok) {
        // ロールバック
        setState((s) => ({ ...s, [buttonType]: prev }));
        if (res.status === 401) {
          showToast('ログインが必要です');
        } else if (res.status === 429) {
          showToast('投票上限に達しました。しばらく経ってからお試しください');
        } else if (res.status === 409) {
          // 別タブで操作されてサーバー状態と齟齬。サーバーの状態に合わせる
          showToast('投票状態を再取得しました');
          try {
            const r2 = await fetch(`/api/games/${universeId}/votes`, {
              credentials: 'include',
              cache: 'no-store',
            });
            if (r2.ok) {
              const b = await r2.json();
              setState({
                like: { count: b.like.count, voted: b.like.user_voted },
                save: { count: b.save.count, voted: b.save.user_voted },
                recommend: { count: b.recommend.count, voted: b.recommend.user_voted },
              });
            }
          } catch {}
        } else {
          showToast('投票に失敗しました。もう一度お試しください');
        }
        return;
      }

      const body = await res.json();
      setState((s) => ({
        ...s,
        [buttonType]: { count: body.vote_count, voted: body.user_voted },
      }));
    } catch {
      setState((s) => ({ ...s, [buttonType]: prev }));
      showToast('通信エラー。もう一度お試しください');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        {BUTTONS.map((b) => {
          const s = state[b.key];
          const active = s.voted;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => handleClick(b.key)}
              disabled={busy !== null}
              aria-pressed={active}
              title={b.hint}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-2 transition-colors',
                'text-sm tabular-nums select-none',
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-foreground border-border hover:bg-muted',
                busy === b.key ? 'opacity-60 cursor-progress' : '',
                busy && busy !== b.key ? 'opacity-60' : '',
              ].join(' ')}
            >
              <span className="text-base leading-none">
                <span aria-hidden="true">{b.emoji}</span>
                <span className="ml-1.5 font-medium">{s.count.toLocaleString('ja-JP')}</span>
              </span>
              <span className="text-[11px] leading-none text-muted-foreground">
                {b.label}
              </span>
            </button>
          );
        })}
      </div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground text-center"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
