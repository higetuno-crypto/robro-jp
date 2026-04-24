'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GameSearchForm() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = parseInput(input);
    if (id === null) {
      setError('universeId か Robloxゲーム URL を入れてください');
      return;
    }
    router.push(`/admin/games/${id}`);
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="123456 または https://www.roblox.com/games/123456/xxx"
        className="flex-1 border border-border px-2 py-1 bg-background text-[13px]"
      />
      <button
        type="submit"
        className="px-3 py-1 text-[13px] bg-foreground text-background"
      >
        開く
      </button>
      {error && (
        <div className="text-[12px] text-red-600 self-center">{error}</div>
      )}
    </form>
  );
}

function parseInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // 純数値
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  // Roblox URL: placeId しか取れないがひとまず数値部分を抽出
  const m = s.match(/games\/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}
