'use client';

import { useState } from 'react';
import { createSupabaseClientClient } from '@/lib/supabase-browser';

export function LoginButtons({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseClientClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setError('ログインに失敗しました');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading}
        className="w-full px-4 py-2 text-[14px] border border-foreground hover:bg-muted disabled:opacity-40"
      >
        {loading ? '…' : 'Googleでログイン'}
      </button>
      {error && (
        <div className="text-[12px] text-red-600">{error}</div>
      )}
    </div>
  );
}
