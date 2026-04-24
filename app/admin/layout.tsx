import Link from 'next/link';

export const metadata = {
  title: '管理画面 | Roblox Japan Ranking',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-3 py-4">
      <header className="mb-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-[16px] font-semibold">管理画面</h1>
          <nav className="text-[13px] flex gap-4">
            <Link href="/admin/tags" className="hover:underline">タグ</Link>
            <Link href="/" className="text-muted-foreground hover:underline">サイトへ戻る →</Link>
          </nav>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Basic認証済み。誤操作に注意。
        </p>
      </header>
      {children}
    </div>
  );
}
