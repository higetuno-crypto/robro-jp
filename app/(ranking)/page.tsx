import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getRanking } from '@/lib/ranking-query';
import { RankingRow } from '@/components/RankingRow';
import { fetchFeatured } from '@/lib/featured-query';
import { formatRelativeJa } from '@/lib/format';

/**
 * 日本で人気ランキング（/）← デフォルト
 *
 * CLAUDE.md：
 * - 日本語ファースト。ルートは「日本で人気」
 * - 現状は is_japanese=true を一次シグナルとして近似
 *   （Roblox公式 country=JP フィルタは匿名APIでは効かないため）
 * - revalidate = 300
 *
 * トップページ上部に「ピックアップ」の導線ミニセクション。
 */
export const revalidate = 300;

export default async function JapanPopularRankingPage() {
  const supabase = createBrowserClient();
  const [jpRanking, featured] = await Promise.all([
    getRanking(supabase, 'japanese', 100),
    fetchFeatured(supabase, 3),
  ]);

  // フォールバック：日本語ゲームが検出されていないときは全世界総合を表示
  // （初回アクセスでも「データ収集中」になって手触りが悪いのを回避）
  const usingFallback = jpRanking.rows.length === 0;
  const { rows, capturedAt } = usingFallback
    ? await getRanking(supabase, 'overall', 100)
    : jpRanking;

  return (
    <section>
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
        {rows.length === 0
          ? 'データ収集中です。cron が一度回れば表示されます。'
          : usingFallback
          ? `${formatRelativeJa(capturedAt)} ・ 日本語ゲーム未検出のため暫定で全世界総合を表示中（TOP${rows.length}）`
          : `${formatRelativeJa(capturedAt)} ・ 日本で人気 TOP${rows.length}`}
      </div>

      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>
    </section>
  );
}
