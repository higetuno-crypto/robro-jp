'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  ADSENSE_CLIENT_ID,
  ADSENSE_AGE_TREATMENT,
  ADS_ENABLED,
} from '@/lib/ads';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type Props = {
  /** AdSense 管理画面で発行されるスロットID。未設定なら何も描画しない */
  slot: string | undefined;
  /**
   * 枠の予約高さ(px)。レイアウトシフト(CLS)を抑えるために確保する。
   * 未配信時は globals.css の .ad-slot 折りたたみで枠ごと消えるため、
   * 空白が残り続けることはない。
   */
  minHeight?: number;
  className?: string;
};

function AdSlotInner({ slot, minHeight = 100, className }: Props) {
  // StrictMode では effect が2回走るため push の二重実行を防ぐ
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch (e) {
      // 握りつぶさない（コーディング規約）
      console.error('[AdSlot] adsbygoogle push failed', e);
    }
  }, []);

  return (
    <div className={className}>
      {/*
        .ad-slot は globals.css の未配信時折りたたみ（data-ad-status="unfilled"）に使う。
        border-t は、直上のコンテンツ（特にゲーム詳細の攻略Tips＝UGC）と
        広告が地続きに見えないよう視覚的に分離するため。
      */}
      <div className="ad-slot border-t border-border pt-2">
        <div className="text-[12px] text-muted-foreground mb-1">📢 広告</div>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
          data-tag-for-age-treatment={ADSENSE_AGE_TREATMENT}
        />
      </div>
    </div>
  );
}

/**
 * AdSense 広告枠。
 *
 * CLAUDE.md「E. AdSense 広告枠」の節度を実装で担保する：
 *  - 「📢 広告」ラベルを枠上部に必ず表示（ステマ規制 2023-10）
 *  - 18歳未満へのパーソナライズ広告を出さない（data-tag-for-age-treatment）
 *  - 自動再生動画は使わない（静的な display 枠のみ）
 *
 * 呼び出し側で「ランキング行間」「ファーストビュー」に置かないこと。
 * 非コンテンツページ（/admin・404・エラー）に出さない判定は FooterAd 側で行う。
 */
export function AdSlot({ slot, minHeight, className }: Props) {
  const pathname = usePathname();

  // スロット未設定・機能フラグ off の時は枠ごと出さない。
  // これにより ID が揃う前にデプロイしても表示崩れが起きない。
  if (!ADS_ENABLED || !slot) return null;

  // pathname を key にして、クライアント遷移のたびに <ins> を作り直す。
  // App Router では layout/page が再マウントされないため、これが無いと
  // 初回ハードロードの1回しか広告リクエストが飛ばず、
  // /game/A → /game/B の遷移では古い広告が residual 表示され続ける。
  return (
    <AdSlotInner
      key={pathname}
      slot={slot}
      minHeight={minHeight}
      className={className}
    />
  );
}
