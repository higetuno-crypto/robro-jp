import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { LoginButtons } from './LoginButtons';

export const metadata = {
  title: 'ログイン',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * `next` パラメータをローカル相対パスに正規化する。
 *   - 先頭が `/` で始まり、かつ `//` で始まらないものだけ受け入れる
 *   - それ以外（外部URL、protocol-relative `//evil.com`、`javascript:` など）は `/` にフォールバック
 *   - app/auth/callback/route.ts でも同じロジックを使う
 */
function safeNext(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

export default async function LoginPage(
  props: {
    searchParams: Promise<{ next?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  const next = safeNext(searchParams.next);
  if (user) redirect(next);
  return (
    <div className="max-w-md mx-auto px-3 py-8">
      <h1 className="text-[18px] font-semibold mb-2">ログイン</h1>
      <p className="text-[13px] text-muted-foreground mb-6">
        サイトの閲覧はログイン不要です。タグを付けるなど投票にはログインが必要です。
      </p>
      <LoginButtons next={next} />
      <p className="mt-8 text-[11px] text-muted-foreground">
        ログインすると
        <a href="/terms" className="underline mx-1">利用規約</a>と
        <a href="/privacy" className="underline mx-1">プライバシーポリシー</a>
        に同意したものとみなします。
      </p>
    </div>
  );
}
