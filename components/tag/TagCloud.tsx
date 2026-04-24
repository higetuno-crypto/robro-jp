import type { GameTag } from '@/lib/tags';
import { TagBadge } from './TagBadge';

/**
 * ゲーム詳細ページに埋め込むタグ一覧。
 *
 * 並び：公式タグ（sort_order） → ユーザータグ（得票降順TOP N）
 * 投稿は TagPickerModal（client component）に任せるのでここは表示のみ。
 */
export function TagCloud({
  official,
  community,
}: {
  official: GameTag[];
  community: GameTag[];
}) {
  const hasAny = official.length > 0 || community.length > 0;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {official.map((t) => (
        <TagBadge key={t.tagId} tag={t} showVoteCount />
      ))}
      {community.map((t) => (
        <TagBadge key={t.tagId} tag={t} showVoteCount />
      ))}
    </div>
  );
}
