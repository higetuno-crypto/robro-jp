import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase-ssr';

/**
 * サイト共通ヘッダー。
 * CLAUDE.md：[ランキング] [タグ] [ピックアップ] [宣伝（フラグ）]
 * ログイン状態を表示：未ログイン時はログインリンク、ログイン時は表示名＋ログアウト。
 */
export async function SiteHeader() {
  const showPromotion = process.env.NEXT_PUBLIC_FEATURE_PROMOTION === 'true';
  const user = await getCurrentUser();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    null;

  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-4">
        <Link href="/" className="text-[14px] font-semibold shrink-0">
          Roblox Japan Ranking
        </Link>
        <nav className="ml-auto flex items-center gap-3 text-[14px] overflow-x-auto whitespace-nowrap min-w-0">
          <Link href="/" className="hover:underline shrink-0">
            ランキング
          </Link>
          <Link href="/stream" className="hover:underline shrink-0">
            配信
          </Link>
          <Link href="/tags" className="hover:underline shrink-0">
            タグ
          </Link>
          <Link href="/featured" className="hover:underline shrink-0">
            ピックアップ
          </Link>
          <Link
            href="/feedback"
            className="text-muted-foreground hover:underline hover:text-foreground shrink-0"
            title="サイトへのご意見・要望"
          >
            ご意見
          </Link>
          {showPromotion && (
            <Link href="/promoted" className="hover:underline shrink-0">
              宣伝
            </Link>
          )}
          {user ? (
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-border text-[13px] shrink-0">
              <Link
                href="/me/savings"
                className="hover:underline shrink-0"
                title="マイリスト（⭐ お気に入り）"
              >
                ⭐
              </Link>
              <span className="text-muted-foreground max-w-[120px] truncate" title={displayName ?? ''}>
                {displayName}
              </span>
              <form action="/auth/logout" method="post">
                <button type="submit" className="hover:underline text-muted-foreground">
                  ログアウト
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="pl-3 ml-1 border-l border-border text-[13px] hover:underline shrink-0"
            >
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
