import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase-ssr';
import { getCreatorByAccountId } from '@/lib/creators';
import { CreatorRegisterForm } from './CreatorRegisterForm';

/**
 * /creators/register クリエイター自薦登録ページ（フェーズ10）
 *
 * フロー（feature-spec.md §5.1）：
 *  1. ログイン必須
 *  2. 表示名・自己紹介・Robloxプロフィール URL・SNSリンク を入力
 *  3. 確認コード生成 → Robloxプロフィール bio に貼ってもらう
 *  4. 「確認する」→ Roblox 公式 users API で description 照合
 *  5. 確認完了で is_verified=TRUE
 *
 * 必須UI表記#3：本人確認の方法を明示。
 */

export const metadata = {
  title: 'クリエイター自薦登録',
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

export default async function CreatorRegisterPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/creators/register');
  }

  const supabase = await createSupabaseServerClient();
  const existing = await getCreatorByAccountId(supabase, user.id);

  return (
    <main className="max-w-xl mx-auto px-3 py-6">
      <h1 className="text-[18px] font-semibold">クリエイター自薦登録</h1>
      <p className="text-[13px] text-muted-foreground mt-1">
        Roblox 上で活動しているあなたを ro-brojp 上で発見されやすくします。完全無料です。
      </p>

      {/* 必須UI表記#3（CLAUDE.md「必須UI表記4種」#3） */}
      <section className="mt-4 border border-border bg-muted/30 px-3 py-2 text-[12px] leading-relaxed">
        <strong className="text-[12px]">本人確認の方法</strong>
        <p className="mt-1 text-muted-foreground">
          本人確認は、あなたが Roblox プロフィール bio に一時掲載した確認コードを、
          公開 users API で照合して行います。パスワード、
          <code className="font-mono text-[11px]">.ROBLOSECURITY</code> Cookie、
          アクセストークンの入力は求めません。
        </p>
        <p className="mt-1 text-muted-foreground">
          照合に使う Roblox プロフィール bio の本文は ro-brojp に保存しません。確認コードの一致判定のみを行います。
        </p>
      </section>

      <CreatorRegisterForm
        initial={
          existing
            ? {
                creator_id: existing.id,
                display_name: existing.display_name,
                self_introduction: existing.self_introduction ?? '',
                avatar_url: existing.avatar_url ?? '',
                roblox_profile_url: existing.roblox_profile_url,
                social_links: existing.social_links ?? [],
                is_verified: existing.is_verified,
                verification_code: existing.verification_code ?? null,
                verification_expires_at: existing.verification_expires_at ?? null,
              }
            : null
        }
      />

      <p className="mt-8 text-[11px] text-muted-foreground">
        登録すると{' '}
        <Link href="/terms" className="underline">利用規約</Link>と{' '}
        <Link href="/privacy" className="underline">プライバシーポリシー</Link>{' '}
        に同意したものとみなします。
      </p>
    </main>
  );
}
