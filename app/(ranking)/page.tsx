import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { fetchFeatured } from '@/lib/featured-query';
import { formatRelativeJa } from '@/lib/format';

/**
 * 総合ランキング（/）
 * 最新スナップショットの playing 降順 TOP100。
 *
 * CLAUDE.md：revalidate = 300（5分ごとの再生成）
 *
 * フェーズ5で追加：トップページ上部に「ピックアップ」の導線ミニセクション。
 *  - ランキング本体とは視覚的に別物に見えるよう、カード3件まで + 区切り線
 *  - ピックアップが0件のときは丸ごと非表示
 */
export const revalidate = 300;

export default async function OverallRankingPage() {
  const supabase = createBrowserClient();
  const [{ rows, capturedAt }, featured] = await Promise.all([
    getRanking(supabase, 'overall', 100),
    fetchFeatured(supabase, 3),
  ]);

  return (
    <section>
      {/* ピックアップミニセクション（0件なら非表示） */}
      {featured.length > 0 && (
        <div className="border-b border-border px-3 py-3">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[13px] font-medium">ピックアップ</div>
            <Link
              href="/featured"
              className="text-[12px] text-muted-foreground hover:underline"
            >
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {featured.map((f) => (
              <Link
                key={f.id}
                href={`/game/${f.universeId}`}
                className="block border border-border bg-card hover:bg-muted/40"
              >
                <div className="aspect-[16/9] bg-muted overflow-hidden">
                  {f.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="p-2">
                  <div className="text-[12px] leading-tight truncate font-medium">
                    {f.headline}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {f.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length > 0
          ? `${formatRelativeJa(capturedAt)} ・ 総合 TOP${rows.length}`
          : 'データ収集中です。cron が一度回れば表示されます。'}
      </div>

      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
