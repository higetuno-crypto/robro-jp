import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { listVerifiedCreators } from '@/lib/creators';

/**
 * /creators 一覧ページ（フェーズ10）
 *
 * is_verified=TRUE のクリエイターのみ公開。verified_at の新しい順。
 */

export const metadata = {
  title: 'クリエイター',
  description: 'ro-brojp に自薦登録した日本語圏 Roblox クリエイター一覧',
};

export const revalidate = 300;

export default async function CreatorsPage() {
  const supabase = createBrowserClient();
  const creators = await listVerifiedCreators(supabase, 100);

  return (
    <main className="max-w-3xl mx-auto px-3 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-[16px] font-semibold">クリエイター</h1>
        <Link
          href="/creators/register"
          className="text-[13px] underline hover:no-underline"
        >
          自薦登録する →
        </Link>
      </div>
      <p className="text-[13px] text-muted-foreground mt-1">
        日本語圏で活動する Roblox クリエイター。本人申請＋ Roblox プロフィール照合で確認済み。
      </p>

      {creators.length === 0 ? (
        <div className="mt-6 text-[13px] text-muted-foreground">
          まだ登録クリエイターはいません。あなたが Roblox クリエイターなら{' '}
          <Link href="/creators/register" className="underline">こちらから登録</Link>{' '}
          できます。
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {creators.map((c) => (
            <li key={c.id}>
              <Link
                href={`/creators/${c.id}`}
                className="flex items-center gap-3 py-3 hover:bg-muted/40 px-1"
              >
                <div className="w-12 h-12 shrink-0 bg-muted overflow-hidden">
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatar_url}
                      alt={c.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate">
                    {c.display_name}
                    <span
                      className="ml-1 text-[11px] text-muted-foreground"
                      title="Roblox プロフィール照合で確認済み"
                    >
                      ✓
                    </span>
                  </div>
                  {c.self_introduction ? (
                    <div className="text-[12px] text-muted-foreground truncate">
                      {c.self_introduction.slice(0, 80)}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
