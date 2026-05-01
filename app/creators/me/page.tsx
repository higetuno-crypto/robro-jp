import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase-ssr';
import {
  getCreatorByAccountId,
  listCreatorGames,
  isVerificationCodeExpired,
} from '@/lib/creators';
import { MyPageClient } from './MyPageClient';

/**
 * /creators/me クリエイター本人のマイページ（フェーズ10）
 *
 * 機能：
 *  - 認証状態の表示（verified ✓ or 未verified）
 *  - 代表作の追加（Roblox ゲーム URL を貼り付けて登録）
 *  - 既存代表作の管理（is_primary 切替・削除）
 *  - プロフィール編集導線（/creators/register に飛ばす：再発行と更新は同じフロー）
 */

export const metadata = {
  title: 'クリエイターマイページ | Roblox Japan Ranking',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CreatorMyPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/creators/me');
  }

  const supabase = createSupabaseServerClient();
  const creator = await getCreatorByAccountId(supabase, user.id);

  if (!creator) {
    return (
      <main className="max-w-xl mx-auto px-3 py-6">
        <h1 className="text-[18px] font-semibold">クリエイターマイページ</h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          まだクリエイター登録がされていません。
        </p>
        <Link
          href="/creators/register"
          className="mt-4 inline-block px-4 py-2 text-[14px] border border-foreground hover:bg-muted"
        >
          クリエイター登録をはじめる →
        </Link>
      </main>
    );
  }

  const games = creator.is_verified ? await listCreatorGames(supabase, creator.id) : [];
  const codeExpired = creator.verification_code
    ? isVerificationCodeExpired(creator)
    : true;

  return (
    <main className="max-w-2xl mx-auto px-3 py-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-[18px] font-semibold">クリエイターマイページ</h1>
        {creator.is_verified ? (
          <Link
            href={`/creators/${creator.id}`}
            className="text-[12px] underline"
          >
            公開プロフィールを見る →
          </Link>
        ) : null}
      </header>

      <section className="mt-4 border border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium">{creator.display_name}</span>
          {creator.is_verified ? (
            <span className="text-[11px] text-muted-foreground" title="本人確認済み">
              ✓ 確認済み
            </span>
          ) : (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              未確認（公開されていません）
            </span>
          )}
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground break-all">
          <a
            href={creator.roblox_profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {creator.roblox_profile_url}
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
          <Link href="/creators/register" className="underline">
            プロフィールを編集
          </Link>
          {!creator.is_verified ? (
            <Link href="/creators/register" className="underline">
              {codeExpired ? '確認コードを再発行' : '確認手続きを続ける'}
            </Link>
          ) : null}
        </div>
      </section>

      {creator.is_verified ? (
        <MyPageClient
          creatorId={creator.id}
          initialGames={games.map((g) => ({
            universe_id: g.universe_id,
            is_primary: g.is_primary,
            name: g.name,
            thumbnail_url: g.thumbnail_url,
            creator_name: g.creator_name,
          }))}
        />
      ) : (
        <p className="mt-6 text-[13px] text-muted-foreground">
          代表作の登録は、Robloxプロフィールでの本人確認後に行えます。
        </p>
      )}

      <p className="mt-10 text-[10px] text-muted-foreground leading-relaxed">
        代表作の登録時、Roblox 公式 API でゲームの作者を確認します。
        ゲームの作者（ユーザーまたはグループのオーナー）があなたの確認済み Roblox アカウントと一致しない場合は登録できません。
      </p>
    </main>
  );
}
