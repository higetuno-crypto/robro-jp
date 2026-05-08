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

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Roblox 配信ネタ用途別スロット',
    numberOfItems: slots.length,
    itemListElement: slots.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ro-brojp.com/stream/${s.slotKey}`,
      name: s.displayName,
    })),
  };

  return (
    <section className="max-w-3xl mx-auto px-3 py-3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
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
