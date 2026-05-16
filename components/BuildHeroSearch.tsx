'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { VoteButtons } from './VoteButtons';

/**
 * トップヒーロー：「あなたの推しは？」検索 + 投票UI
 *
 * 既存 `/api/search/games`（DB＋Roblox 公式のハイブリッド検索）を流用。
 * 結果カードに既存 `VoteButtons` をその場で配置し、検索 → 投票を1画面で完結させる。
 *
 * ログイン要件は VoteButtons 側に委譲（未ログイン押下時に /login へ）。
 */

interface SearchHit {
  universeId: number;
  placeId: number | null;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  playing: number | null;
  inDb: boolean;
}

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 6;

export function BuildHeroSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const trimmed = q.trim();
    const myReqId = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      if (!trimmed) {
        if (myReqId === reqIdRef.current) {
          setHits([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search/games?q=${encodeURIComponent(trimmed)}&limit=${MAX_RESULTS}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          if (myReqId === reqIdRef.current) setHits([]);
          return;
        }
        const body = (await res.json()) as { hits: SearchHit[] };
        if (myReqId === reqIdRef.current) {
          setHits((body.hits ?? []).slice(0, MAX_RESULTS));
        }
      } catch {
        if (myReqId === reqIdRef.current) setHits([]);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, trimmed ? DEBOUNCE_MS : 0);

    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <label
        htmlFor="build-hero-search"
        className="block text-[12px] font-medium mb-1"
      >
        あなたの推しは？
      </label>
      <input
        id="build-hero-search"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (!touched) setTouched(true);
        }}
        placeholder="ゲーム名・開発者名を入力"
        className="w-full border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-foreground"
        autoComplete="off"
      />

      {/* 結果リスト or ヒント */}
      <div className="mt-2">
        {!touched && (
          <p className="text-[11px] text-muted-foreground leading-snug">
            例：「Blox Fruits」「タイクーン」など。見つかったら ❤️⭐🔥 で一票！
          </p>
        )}
        {touched && q.trim() && loading && hits.length === 0 && (
          <p className="text-[12px] text-muted-foreground">検索中…</p>
        )}
        {touched && q.trim() && !loading && hits.length === 0 && (
          <p className="text-[12px] text-muted-foreground">該当ゲームが見つかりませんでした。</p>
        )}

        {hits.length > 0 && (
          <ul className="divide-y divide-border border border-border">
            {hits.map((h) => (
              <li key={h.universeId} className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/game/${h.universeId}`}
                    className="flex items-center gap-2 min-w-0 flex-1 hover:bg-muted/50 -mx-1 px-1 py-0.5"
                  >
                    <div className="w-12 h-12 bg-muted overflow-hidden shrink-0">
                      {h.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.thumbnailUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-tight truncate font-medium">
                        {h.name}
                      </div>
                      <div className="text-[12px] leading-tight text-muted-foreground truncate">
                        {h.creatorName ?? '-'}
                        {!h.inDb && (
                          <span className="ml-2 text-[10px] border border-border px-1 rounded-sm align-middle">
                            未掲載
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="mt-2">
                  <VoteButtons universeId={h.universeId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
