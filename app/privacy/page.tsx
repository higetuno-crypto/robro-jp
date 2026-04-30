import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | Roblox Japan Ranking',
  description: '本サイトにおける個人関連情報の取り扱いについて',
};

// NOTE: 文面は Yuki 最終確認前提の雛形。実運用前に法律家レビューを推奨。

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-3 py-6 text-[14px] leading-relaxed space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold">プライバシーポリシー</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">最終更新日：2026年4月30日</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">1. はじめに</h2>
        <p>
          本サイト（robro-jp）の運営者（以下「運営者」）は、本サイトを利用される方（以下「利用者」）のプライバシーを尊重し、
          取得する情報を必要最小限に留めることを基本方針とします。本ポリシーは、本サイトにおける個人関連情報の
          取り扱いについて定めたものです。
        </p>
        <p>
          本サイトは Roblox Corporation の公式サービスではなく、Roblox による承認・提携・スポンサー提供も受けていません。
          本サイトに表示される Roblox のゲーム情報は、Roblox が公開している API から取得した公開データに限られます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">2. 取得する情報</h2>

        <h3 className="text-[14px] font-medium mt-3">2.1 利用者全般から取得する情報</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>アクセス元IPアドレスのハッシュ値（不可逆変換済み）</li>
          <li>ユーザーエージェント文字列のハッシュ値（不可逆変換済み）</li>
          <li>アクセス日時、閲覧ページ、リファラ等のアクセスログ</li>
        </ul>
        <p>
          上記のIP・ユーザーエージェントはハッシュ化された「fingerprint」として記録され、元の値を復元することはできません。
        </p>

        <h3 className="text-[14px] font-medium mt-3">2.2 ログイン利用者から取得する情報</h3>
        <p>
          本サイトのログインには Supabase Authentication（Magic Link 方式）を利用しています。ログイン利用者については、追加で以下を取得します。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>メールアドレス（ログイン認証用）</li>
          <li>表示名（任意設定）</li>
          <li>本サイト内での投票履歴（❤️好き / ⭐お気に入り / 🔥頼むから人来て）</li>
          <li>本サイト内でのマイリスト（⭐ お気に入り登録したゲームのID一覧）</li>
          <li>本サイト内でのタグ投票履歴</li>
          <li>本サイト内でのご意見投稿、フィードバック投票</li>
        </ul>

        <h3 className="text-[14px] font-medium mt-3">2.3 取得しない情報</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>本サイトは <strong>Roblox アカウントとの連携機能（OAuth等）を提供しません</strong>。Roblox のログイン情報・パスワード・<code>.ROBLOSECURITY</code> Cookie・アクセストークン等を取得することはありません。</li>
          <li>本サイト内投票は本サイトの独自集計であり、Roblox 側へ送信されることはありません。</li>
          <li>位置情報・連絡先・カメラ・マイク等のセンシティブな情報は取得しません。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">3. 利用目的</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>本サイトのコンテンツ表示および機能提供（ランキング、投票、マイリスト等）</li>
          <li>重複投票・荒らし行為・スパムの検知と防止</li>
          <li>本サイトの安定運営・不正アクセス対策</li>
          <li>本サイトのコンテンツ品質改善のための統計的分析</li>
          <li>法令に基づく開示請求への対応</li>
        </ul>
        <p>
          取得した情報を Roblox アカウントと紐付けたり、Roblox 社または第三者に販売・提供することはありません。
          また、本サイトで取得した情報を生成AI・機械学習モデルの訓練データとして使用することはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">4. 保存期間</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>投票・タグ投票の生ログ</strong>（fingerprint を含む）：取得日から原則 6ヶ月以上1年以内（日本のプロバイダ責任制限法に基づく発信者情報開示請求への対応のため）。期間経過後は順次匿名化または削除します。</li>
          <li><strong>アカウント情報</strong>：アカウント有効期間中は保持。退会申請から30日以内に削除します。</li>
          <li><strong>アクセスログ</strong>：90日を目安に削除します。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">5. 第三者提供</h2>
        <p>
          法令に基づく開示請求（発信者情報開示請求、裁判所からの令状等）がある場合を除き、取得した情報を第三者に提供することはありません。
        </p>
        <p>
          なお、本サイトのインフラ（ホスティング・データベース・認証等）として、以下の事業者のサービスを利用しています。各事業者は本サイトの運営に必要な範囲で情報を処理します。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Vercel Inc.（ホスティング）</li>
          <li>Supabase Inc.（データベース、認証）</li>
          <li>GitHub, Inc.（バージョン管理、自動化）</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">6. 13歳未満・18歳未満の利用者について</h2>
        <p>
          本サイトは全年齢を対象としていますが、特に未成年の利用者については以下の取扱いを行います。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>13歳未満の方は保護者の同意のもとでご利用ください。13歳未満の方が本サイトを利用したことによる情報取得が判明した場合、速やかに該当情報を削除します。</li>
          <li>将来本サイトに広告が表示される場合、未成年に対するパーソナライズ広告（行動ターゲティング広告）は制限される場合があります。</li>
        </ul>
        <p>保護者の方からの削除請求は、下記「8. お問い合わせ・削除請求」よりご連絡ください。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">7. Cookie・類似技術</h2>
        <p>
          本サイトは以下の目的で Cookie を使用しています。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>ログイン状態の維持（Supabase Authentication が発行する認証用 Cookie）</li>
          <li>サイトの基本機能（ダークモード設定、表示設定等）</li>
        </ul>
        <p>
          現時点でトラッキング目的・広告配信目的の Cookie は使用していません。将来アクセス解析・広告配信等の目的で Cookie を利用する場合、本ポリシーを改定の上、事前に通知します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">8. お問い合わせ・削除請求</h2>
        <p>
          ご自身の情報に関する開示・訂正・削除のご請求、および本ポリシーに関するお問い合わせは、
          <Link href="/contact" className="underline">お問い合わせ・削除申請ページ</Link>よりご連絡ください。
          一次対応を24時間以内、最終対応を14日以内に行うことを目標とします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">9. Roblox 由来データの取り扱い</h2>
        <p>
          本サイトに表示される Roblox 上のゲーム名、サムネイル、説明文、CCU（同時接続数）等は、
          Roblox が公開する公式 API（<code>explore-api</code>、<code>games/v1</code>、<code>users/v1</code>、<code>thumbnails</code> 等）から取得した公開データです。
        </p>
        <p>
          Roblox Corporation または Roblox のクリエイターから当該データの削除要請があった場合、運営者は速やかに該当データを本サイトから削除します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">10. 改定</h2>
        <p>
          本ポリシーの内容は、法令の変更、サービス内容の変更その他の事情により予告なく改定することがあります。
          重要な変更がある場合は、本サイト上で事前に通知します。
        </p>
      </section>

      <section className="space-y-2 text-[12px] text-muted-foreground border-t border-border pt-4">
        <p>
          本ポリシーに関する不明点は <Link href="/contact" className="underline">お問い合わせ</Link> までご連絡ください。
        </p>
      </section>
    </main>
  );
}
