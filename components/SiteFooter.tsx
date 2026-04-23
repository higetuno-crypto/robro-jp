import Link from 'next/link';

/**
 * サイト共通フッター。
 * Roblox App Terms（資料2 L34）の「公式ではない」明示要件に自発的に準拠する
 * ディスクレーマーと、プライバシー・規約・問い合わせへの導線を提供する。
 * 装飾は最小、ランキングページの淡々としたトーンに揃える。
 */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border">
      <div className="max-w-3xl mx-auto px-3 py-6 text-[12px] text-muted-foreground leading-relaxed space-y-3">
        <p>
          当サイトは Roblox Corporation の公式サービスではありません。
          ゲーム情報は Roblox の公開データを元に独自に編集しています。
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:underline">
            プライバシーポリシー
          </Link>
          <Link href="/terms" className="hover:underline">
            利用規約
          </Link>
          <Link href="/contact" className="hover:underline">
            お問い合わせ・削除申請
          </Link>
        </nav>
      </div>
    </footer>
  );
}
