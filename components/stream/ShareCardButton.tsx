'use client';

import { useState } from 'react';

/**
 * 紹介カード（OG画像）を開いて X シェアできるボタン。
 * モーダルで OG 画像プレビュー → X 共有 or 画像リンクコピー。
 */
export function ShareCardButton({
  universeId,
  gameName,
  shortPitch,
}: {
  universeId: number;
  gameName: string;
  shortPitch?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const siteOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const ogUrl = `${siteOrigin}/api/og/game/${universeId}`;
  const pageUrl = `${siteOrigin}/game/${universeId}`;
  const text = shortPitch
    ? `${gameName} — ${shortPitch}`
    : `${gameName} の配信向けまとめ`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(pageUrl)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-3 py-1.5 text-[13px] border border-foreground hover:bg-muted/40"
      >
        紹介カードを開く
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border border-border max-w-lg w-full p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-medium">紹介カード</div>
              <button
                type="button"
                className="text-[12px] text-muted-foreground hover:underline"
                onClick={() => setOpen(false)}
              >
                閉じる
              </button>
            </div>
            <div className="bg-muted aspect-[1200/630] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ogUrl} alt="紹介カード" className="w-full h-full object-cover" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={xUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-[13px] bg-foreground text-background hover:opacity-90"
              >
                Xで共有
              </a>
              <a
                href={ogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-[13px] border border-border hover:bg-muted/40"
              >
                画像を開く
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pageUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* noop */
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 text-[13px] border border-border hover:bg-muted/40"
              >
                {copied ? 'コピーしました' : 'URLをコピー'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
