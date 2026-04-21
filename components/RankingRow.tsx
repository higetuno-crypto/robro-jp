import Link from 'next/link';
import type { RankingRowData } from '@/types/game';
import { formatNumber } from '@/lib/format';

/**
 * ランキング1行。
 *
 * CLAUDE.md UI設計原則：
 *  - 1位も100位も同じ行高・同じフォントサイズ・同じサムネサイズ
 *  - 順位バッジは 1〜3位のみ色差（金銀銅）OK、ただし**サイズ同一**
 *  - 装飾禁止：影、グラデーション、ホバーアニメーション、派手アイコンNG
 *  - カラム固定：[順位] [サムネ60×60] [タイトル+開発者] [CCU] [変動]
 *  - フォントサイズ2種類まで（タイトル14px / 数値14px tabular-nums）
 *  - 変動だけ色差OK（↑緑/↓赤/NEW青）
 */

function rankBadgeColor(rank: number): string {
  // サイズは固定、色だけ差分
  if (rank === 1) return 'text-[#c9a227]'; // 金
  if (rank === 2) return 'text-[#9aa0a6]'; // 銀
  if (rank === 3) return 'text-[#c77a3a]'; // 銅
  return 'text-gray-500';
}

function DeltaCell({ delta }: { delta: number | null }) {
  // 固定幅で右寄せ、色差のみ
  if (delta === null) {
    return (
      <span className="inline-block text-[13px] tabular-nums text-blue-600 font-medium">
        NEW
      </span>
    );
  }
  if (delta === 0) {
    return <span className="inline-block text-[14px] tabular-nums text-gray-400">―</span>;
  }
  if (delta > 0) {
    return (
      <span className="inline-block text-[14px] tabular-nums text-green-600">
        ↑{delta}
      </span>
    );
  }
  return (
    <span className="inline-block text-[14px] tabular-nums text-red-600">
      ↓{-delta}
    </span>
  );
}

export function RankingRow({ row }: { row: RankingRowData }) {
  return (
    <Link
      href={`/game/${row.universeId}`}
      className="grid grid-cols-[40px_60px_1fr_90px_64px] gap-3 items-center px-3 py-2 border-b border-border hover:bg-muted/50"
    >
      {/* 順位 */}
      <div
        className={`text-[14px] tabular-nums text-right font-medium ${rankBadgeColor(row.rank)}`}
      >
        {row.rank}
      </div>

      {/* サムネ 60×60 */}
      <div className="w-[60px] h-[60px] bg-muted overflow-hidden shrink-0">
        {row.thumbnailUrl ? (
          // next/image は外部CDN設定が必要なので普通のimgで。サムネは60×60固定。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.thumbnailUrl}
            alt=""
            width={60}
            height={60}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      {/* タイトル + 開発者（2行まで / オーバーフロー省略） */}
      <div className="min-w-0">
        <div className="text-[14px] leading-tight truncate">{row.name}</div>
        <div className="text-[14px] leading-tight text-muted-foreground truncate">
          {row.creatorName ?? '-'}
        </div>
      </div>

      {/* CCU（playing）右寄せ tabular-nums */}
      <div className="text-[14px] tabular-nums text-right">
        {formatNumber(row.playing)}
      </div>

      {/* 変動 */}
      <div className="text-right">
        <DeltaCell delta={row.rankDelta} />
      </div>
    </Link>
  );
}
