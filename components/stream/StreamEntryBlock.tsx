import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { fetchAllSlots, fetchSlotGameCounts } from '@/lib/streaming';
import { StreamSlotCard } from './StreamSlotCard';

/**
 * トップページに置く「配信ネタを探す」入口ブロック。
 * CLAUDE.md：ランキング側の淡々としたトーンに合わせる。
 */
export async function StreamEntryBlock() {
  const supabase = createBrowserClient();
  const [slots, counts] = await Promise.all([
    fetchAllSlots(supabase).catch((e) => {
      console.error('[StreamEntryBlock slots]', e);
      return [];
    }),
    fetchSlotGameCounts(supabase).catch((e) => {
      console.error('[StreamEntryBlock counts]', e);
      return new Map<string, number>();
    }),
  ]);
  if (slots.length === 0) return null;

  return (
    <div className="border-b border-border px-3 py-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[13px] font-medium">今夜の配信ネタを探す</div>
        <Link
          href="/stream"
          className="text-[12px] text-muted-foreground hover:underline"
        >
          すべての用途 →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((s) => (
          <StreamSlotCard
            key={s.slotKey}
            slotKey={s.slotKey}
            title={s.displayName}
            description={s.description}
            count={counts.get(s.slotKey)}
          />
        ))}
      </div>
    </div>
  );
}
