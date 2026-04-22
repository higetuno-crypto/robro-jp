import type { GameTag, TagMaster } from '@/lib/tags';

/**
 * タグバッジ。
 *
 * CLAUDE.md UI原則（タグページ）：
 *  - 公式：塗り（background色）
 *  - ユーザー：枠線（border）
 *  - 得票数は任意表示
 *  - サイズは showVoteCount の有無で変えない（混乱させない）
 */
export function TagBadge({
  tag,
  showVoteCount = false,
}: {
  tag: TagMaster | GameTag;
  showVoteCount?: boolean;
}) {
  const isOfficial = tag.tagType === 'official';
  const voteCount = 'voteCount' in tag ? tag.voteCount : undefined;

  const base =
    'inline-flex items-center text-[12px] leading-none px-2 py-1 tabular-nums';
  const variant = isOfficial
    ? 'bg-foreground text-background'
    : 'border border-foreground text-foreground';

  return (
    <span className={`${base} ${variant}`} title={tag.description ?? undefined}>
      {tag.tagName}
      {showVoteCount && typeof voteCount === 'number' && voteCount > 0 ? (
        <span className="ml-1 opacity-70">{voteCount}</span>
      ) : null}
    </span>
  );
}
