import { createBrowserClient } from '@/lib/supabase';
import { fetchAllSlots, fetchSlotGameCounts } from '@/lib/streaming';
import { StreamSlotCard } from '@/components/stream/StreamSlotCard';

/**
 * /stream — 配信者向けハブトップ。
 * CLAUDE.md：6枠の用途別スロットカード。DB駆動（stream_slots）。
 */
export const revalidate = 1800;

export const metadata = {
  title: '配信ネタ',
  description: '配信者向けに、扱いやすいRobloxをスロット別に集めました。',
};

export default async function StreamHubPage() {
  const supabase = createBrowserClient();
  const [slots, counts] = await Promise.all([
    fetchAllSlots(supabase),
    fetchSlotGameCounts(supabase),
  ]);

  return (
    <section className="max-w-3xl mx-auto px-3 py-3">
      <header className="mb-4">
        <h1 className="text-[18px] font-semibold">今夜の配信ネタを探す</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          日本人向けに、扱いやすい Roblox を用途別に集めました。
        </p>
      </header>

      {slots.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          スロットが未登録です。管理画面から追加してください。
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      )}
    </section>
  );
}
