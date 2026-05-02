import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'お問い合わせ・削除申請',
  description: '本サイトへのお問い合わせ・掲載情報の削除申請窓口',
};

const CONTACT_EMAIL = 'robranking.japan@gmail.com';

export default function ContactPage() {
  const subjectRemoval = encodeURIComponent('[削除申請] ');
  const subjectGeneral = encodeURIComponent('[お問い合わせ] ');
  const subjectRoblox = encodeURIComponent('[Roblox由来データ削除] ');

  return (
    <main className="max-w-3xl mx-auto px-3 py-6 text-[14px] leading-relaxed space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold">お問い合わせ・削除申請</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          本サイト（ro-brojp）に関するご質問、および掲載情報の削除申請を受け付けます。
        </p>
      </header>

      <section className="rounded border border-border bg-muted/30 px-3 py-2 text-[13px]">
        <p>
          ※ 本サイトは Roblox Corporation の公式サービスではありません。Roblox プラットフォーム自体・各ゲーム・Roblox アカウントに関するお問い合わせは、
          <a
            href="https://www.roblox.com/support"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Roblox 公式サポート
          </a>
          へお願いします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">受付窓口</h2>
        <p>下記メールアドレス宛にご連絡ください。</p>
        <p className="font-mono">
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-[13px] text-muted-foreground">
          対応SLA：一次対応 24時間以内・最終対応 14日以内を目標としています（連休・深夜帯等は返信が遅れる場合があります）。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">掲載情報の削除申請</h2>
        <p>
          ご自身が権利を有するゲーム情報・画像等の掲載削除を希望される場合、以下の情報を添えてご連絡ください。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>対象ページのURL（本サイト上のアドレス）</li>
          <li>対象となるゲームID（UniverseId）または掲載項目</li>
          <li>権利者である旨の証明（Roblox クリエイターアカウントのプロフィールURL、または商標権者である証明等）</li>
          <li>削除を求める理由（任意）</li>
          <li>ご連絡先のメールアドレス</li>
        </ul>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${subjectRemoval}`}
            className="underline"
          >
            削除申請メールを作成する
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">Roblox Corporation からの削除要請</h2>
        <p>
          Roblox Corporation より、本サイトに掲載した Roblox 由来データの削除要請があった場合、
          運営者は当該データを速やかに削除します。下記件名で公式ドメインからご連絡ください。
        </p>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${subjectRoblox}`}
            className="underline"
          >
            Roblox 由来データ削除要請メールを作成する
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">プライバシーに関するご請求</h2>
        <p>
          ご自身の情報の開示・訂正・削除のご請求は、上記窓口よりご連絡ください。
          詳細は<Link href="/privacy" className="underline">プライバシーポリシー</Link>をご参照ください。
        </p>
        <p className="text-[13px] text-muted-foreground">
          13歳未満のお子様の保護者の方からの削除請求にも対応します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">その他のお問い合わせ</h2>
        <p>
          タグの修正提案、ピックアップゲームの推薦、取材・掲載等のご依頼もこちらから受け付けます。
        </p>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${subjectGeneral}`}
            className="underline"
          >
            一般のお問い合わせメールを作成する
          </a>
        </p>
        <p className="text-[13px] text-muted-foreground">
          機能の要望・不具合報告は、サイト内の<Link href="/feedback" className="underline">ご意見ボード</Link>から投稿することもできます（ログインが必要です）。
        </p>
      </section>
    </main>
  );
}
