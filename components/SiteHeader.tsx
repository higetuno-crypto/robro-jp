import Link from 'next/link';

/**
 * サイト共通ヘッダー。
 * CLAUDE.md：[ランキング] [ピックアップ] [宣伝（フェーズ6以降）]
 * 宣伝は NEXT_PUBLIC_FEATURE_PROMOTION=true のときのみ表示（現状非表示）。
 */
export function SiteHeader() {
  const showPromotion = process.env.NEXT_PUBLIC_FEATURE_PROMOTION === 'true';
  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-4">
        <Link href="/" className="text-[14px] font-semibold">
          Roblox Japan Ranking
        </Link>
        <nav className="ml-auto flex gap-3 text-[14px]">
          <Link href="/" className="hover:underline">
            ランキング
          </Link>
          <Link href="/featured" className="hover:underline">
            ピックアップ
          </Link>
          {showPromotion && (
            <Link href="/promoted" className="hover:underline">
              宣伝
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
