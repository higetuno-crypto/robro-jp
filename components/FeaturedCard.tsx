import Link from 'next/link';
import type { FeaturedItem } from '@/lib/featured-query';

/**
 * ピックアップカード。
 *
 * CLAUDE.md UI原則：
 *  - ランキング行と明確に別物に見える見た目
 *  - 大きいサムネ、キャッチコピーOK、推薦コメント必須
 *  - 熱量を出してよい場所（ただし節度）
 */
export function FeaturedCard({ item }: { item: FeaturedItem }) {
  return (
    <Link
      href={`/game/${item.universeId}`}
      className="block border border-border bg-card hover:bg-muted/40"
    >
      {/* サムネ（16:9想定だが 1:1 でも崩れないよう aspect で固定） */}
      <div className="aspect-[16/9] w-full bg-muted overflow-hidden">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="p-3">
        <div className="text-[15px] font-medium leading-snug break-words">
          {item.headline}
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground truncate">
          {item.name}
          {item.creatorName ? ` / ${item.creatorName}` : ''}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
          {item.comment}
        </p>
      </div>
    </Link>
  );
}
