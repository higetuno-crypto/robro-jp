import Link from 'next/link';
import type { VoteRankingRow as VoteRankingRowData } from '@/lib/vote-ranking-query';
import { formatNumber } from '@/lib/format';

/**
 * フェーズ8：ボタン別ランキング1行（❤️/⭐/🔥ランキング用）。
 *
 * RankingRow とほぼ同形だが、CCU の代わりに票数を表示する。
 * UI設計原則を継承：1位も100位も同じ行高・サイズ・装飾なし。
 */

function rankBadgeColor(rank: number): string {
  if (rank === 1) return 'text-[#c9a227]';
  if (rank === 2) return 'text-[#9aa0a6]';
  if (rank === 3) return 'text-[#c77a3a]';
  return 'text-gray-500';
}

export function VoteRankingRow({
  row,
  emoji,
}: {
  row: VoteRankingRowData;
  emoji: string;
}) {
  return (
    <Link
      href={`/game/${row.universeId}`}
      className="grid grid-cols-[40px_60px_1fr_90px] gap-3 items-center px-3 py-2 border-b border-border hover:bg-muted/50"
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

      {/* タイトル + 開発者 */}
      <div className="min-w-0">
        <div className="text-[14px] leading-tight truncate">{row.name}</div>
        <div className="text-[14px] leading-tight text-muted-foreground truncate">
          {row.creatorName ?? '-'}
        </div>
      </div>

      {/* 票数（emoji + 数値） */}
      <div className="text-[14px] tabular-nums text-right">
        <span aria-hidden="true" className="mr-1">
          {emoji}
        </span>
        {formatNumber(row.voteCount)}
      </div>
    </Link>
  );
}
