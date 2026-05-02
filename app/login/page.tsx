import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { LoginButtons } from './LoginButtons';

export const metadata = {
  title: 'ログイン',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const user = await getCurrentUser();
  const next = typeof searchParams.next === 'string' ? searchParams.next : '/';
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
