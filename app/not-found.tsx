import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ページが見つかりません',
  robots: { index: false },
};

/**
 * 404 ページ — 内部リンクを並べてクローラの遊弋路と「次に見るもの」を提供。
 */
export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto px-3 py-10 text-center space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold">404 — ページが見つかりません</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          指定されたページは存在しないか、削除された可能性があります。
        </p>
      </header>
      <nav className="text-[14px] flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/" className="underline">日本で人気</Link>
        <Link href="/trending" className="underline">急上昇</Link>
        <Link href="/categories" className="underline">カテゴリ</Link>
        <Link href="/new" className="underline">新着</Link>
        <Link href="/global" className="underline">全世界</Link>
        <Link href="/recommends" className="underline">🔥頼むから人来て</Link>
        <Link href="/featured" className="underline">ピックアップ</Link>
        <Link href="/stream" className="underline">配信ネタ</Link>
        <Link href="/tags" className="underline">タグ</Link>
        <Link href="/creators" className="underline">クリエイター</Link>
        <Link href="/guide" className="underline">使い方</Link>
      </nav>
    </main>
  );
}
