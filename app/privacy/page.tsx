import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | Roblox Japan Ranking',
  description: '本サイトにおける個人関連情報の取り扱いについて',
};

// NOTE: 文面は Yuki 最終確認前提の雛形。運営者名・専用問い合わせ先は後で差し替え。
// OPERATOR_NAME_PLACEHOLDER / CONTACT_EMAIL_PLACEHOLDER をgrepで置換する想定。

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-3 py-6 text-[14px] leading-relaxed space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold">プライバシーポリシー</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">最終更新日：2026年4月24日</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">1. はじめに</h2>
        <p>
          本サイトの運営者（以下「運営者」）は、本サイトを利用される方（以下「利用者」）のプライバシーを尊重し、
          取得する情報を必要最小限に留めることを基本方針とします。本ポリシーは、本サイトにおける個人関連情報の
          取り扱いについて定めたものです。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">2. 取得する情報</h2>
        <p>
          本サイトは利用者のRobloxアカウントと連携せず、氏名・メールアドレス等の個人情報を直接収集しません。
          ただし、タグ投票機能における重複投票防止のため、以下の情報を一時的に処理します。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>アクセス元IPアドレスのハッシュ値（不可逆変換済み）</li>
          <li>ユーザーエージェント文字列のハッシュ値（不可逆変換済み）</li>
          <li>投票対象のゲームID・タグID・投票日時</li>
        </ul>
        <p>
          上記のIP・ユーザーエージェントはハッシュ化された「fingerprint」として記録され、
          元の値を復元することはできません。この情報は同一利用者が短時間に複数回投票することを防ぐ目的にのみ使用します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">3. 利用目的</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>タグ投票における重複投票・荒らし行為の検知と防止</li>
          <li>本サイトの安定運営・不正アクセス対策</li>
          <li>本サイトのコンテンツ品質改善のための統計的分析</li>
        </ul>
        <p>
          取得したfingerprintをRobloxアカウントと紐付けたり、Roblox社または第三者に提供することはありません。
          また、生成AI・機械学習モデルの訓練データとして使用することはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">4. 保存期間</h2>
        <p>
          タグ投票の生ログ（fingerprintを含む）は、発信者情報開示請求への対応および不正検知の必要性から、
          取得日から6ヶ月以上1年以内の範囲で保存します。保存期間経過後、fingerprintを含む個人関連情報を匿名化または削除します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">5. 第三者提供</h2>
        <p>
          法令に基づく開示請求（発信者情報開示請求、裁判所からの令状等）がある場合を除き、
          取得した情報を第三者に提供することはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">6. 13歳未満の利用者について</h2>
        <p>
          本サイトは全年齢を対象としていますが、13歳未満の方は保護者の同意のもとでご利用ください。
          13歳未満の方が本サイトを利用したことによる情報取得が判明した場合、速やかに該当情報を削除します。
          保護者の方は、下記「8. お問い合わせ・削除請求」よりご連絡ください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">7. Cookie・類似技術</h2>
        <p>
          本サイトは現時点でトラッキング目的のCookieを使用しません。将来的にアクセス解析・広告等の目的でCookieを利用する場合、
          本ポリシーを改定の上、事前に通知します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">8. お問い合わせ・削除請求</h2>
        <p>
          ご自身の情報に関する開示・訂正・削除のご請求、および本ポリシーに関するお問い合わせは、
          <a href="/contact" className="underline">お問い合わせ・削除申請ページ</a>よりご連絡ください。
          一次対応を24時間以内に行うことを目標とします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">9. 改定</h2>
        <p>
          本ポリシーの内容は、法令の変更その他の事情により予告なく改定することがあります。
          重要な変更がある場合は、本サイト上で事前に通知します。
        </p>
      </section>
    </main>
  );
}
