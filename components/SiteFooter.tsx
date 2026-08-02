import Link from 'next/link';

/**
 * サイト共通フッター。
 *
 * 必須UI表記#1（CLAUDE.md / Creator Third-Party App Terms §1.1.3 / §10）：
 *  - Roblox公式サービスではない
 *  - Robloxによる承認・提携・スポンサー提供を受けていない
 *  - ゲーム情報は Roblox 公開データを独自編集
 *
 * 装飾は最小、ランキングページの淡々としたトーンに揃える。
 */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border">
      <div className="max-w-3xl mx-auto px-3 py-6 text-[12px] text-muted-foreground leading-relaxed space-y-3">
        <p>
          当サイトは Roblox Corporation の公式サービスではなく、
          Roblox による承認・提携・スポンサー提供も受けていません。
          ゲーム情報は Roblox の公開データを元に独自に編集しています。
          「Roblox」は Roblox Corporation の商標です。
        </p>
        {/*
          必須UI表記#4（CLAUDE.md「E. AdSense 広告枠」）：
          広告収益で運営していること、および広告主と表示順位が無関係であることの明示。
          ランキングを聖域として守るための透明性表記。
        */}
        <p>
          サイト運営は広告収益で賄われています。広告主と表示順位は無関係です。
          本サイトの広告は ro-brojp が外部広告配信事業者を通じて掲載しているものであり、
          Roblox 公式広告ではありません。
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/guide" className="hover:underline">
            このサイトの使い方
          </Link>
          <Link href="/feedback" className="hover:underline">
            ご意見・要望
          </Link>
          <Link href="/privacy" className="hover:underline">
            プライバシーポリシー
          </Link>
          <Link href="/terms" className="hover:underline">
            利用規約
          </Link>
          <Link href="/contact" className="hover:underline">
            お問い合わせ・削除申請
          </Link>
          <Link href="/legal/bans" className="hover:underline">
            モデレーションログ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
