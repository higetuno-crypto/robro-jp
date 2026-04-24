/**
 * 配信向けバッジ（一覧カード用）。
 * CLAUDE.md UI原則：装飾は最小限。色で情報を伝えない（テキスト必須）。
 *
 * tagName を渡すラッパは StreamBadgeList。単体は tag_id → 固定ラベルのマップ。
 */

const BADGE_LABELS: Record<string, string> = {
  stream_good: '配信映え',
  collab_good: 'コラボ向き',
  viewer_join: '視聴者参加',
  reaction_good: '初見リアク',
  loud_fun: '叫ぶ系',
  no_english: '英語不要',
  short_play: '短時間',
  easy_rule: 'ルール簡単',
  voice_chat_plus: '通話推奨',
  scale_up: '人数で化ける',
  solo_ok: 'ソロOK',
  slow_burn: 'じわ沼',
};

export function StreamBadge({ tagId }: { tagId: string }) {
  const label = BADGE_LABELS[tagId] ?? tagId;
  return (
    <span className="inline-flex items-center text-[11px] leading-none px-1.5 py-0.5 bg-foreground text-background">
      {label}
    </span>
  );
}

export function StreamBadgeList({ tagIds }: { tagIds: string[] }) {
  if (!tagIds.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tagIds.map((id) => (
        <StreamBadge key={id} tagId={id} />
      ))}
    </div>
  );
}
