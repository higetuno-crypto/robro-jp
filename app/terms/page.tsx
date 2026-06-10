import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '利用規約',
  description: '本サイトの利用規約',
};

// NOTE: 文面は Yuki 最終確認前提の雛形。実運用前に法律家レビューを推奨。

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-3 py-6 text-[14px] leading-relaxed space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold">利用規約</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">最終更新日：2026年6月10日</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第1条（適用）</h2>
        <p>
          本規約は、本サイト（ro-brojp）の運営者（以下「運営者」）が提供する本サイトのすべての機能の利用について、
          運営者と利用者との間に適用されます。本サイトを利用することにより、利用者は本規約に同意したものとみなします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第2条（Roblox Corporation との関係）</h2>
        <p>
          本サイトは Roblox Corporation の公式サービスではありません。運営者は Roblox Corporation
          およびその関連会社（日本国内における契約当事者は Roblox 合同会社）とは一切関係がなく、
          提携・認定・後援・スポンサー提供を受けているものでもありません。
        </p>
        <p>
          本サイトに掲載するゲーム情報・サムネイル画像等は、Roblox が公開する公式 API
          （<code>explore-api</code>、<code>games/v1</code>、<code>users/v1</code>、<code>thumbnails</code> 等）から取得した情報を独自に編集したものです。
          各ゲームの著作権・商標権その他の権利は、Roblox Corporation および各ゲームの権利者に帰属します。
          「Roblox」は Roblox Corporation の商標です。
        </p>
        <p>
          サムネイル画像は Roblox の CDN への直接リンクとして表示しており、本サイトで再配信することはありません。
          本サイトが Roblox の API アクセスを失った場合、または Roblox から削除要請があった場合、
          運営者は Roblox に由来するデータ（ゲーム情報・スナップショット等）を速やかに削除します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第3条（本サイトの機能）</h2>
        <p>
          本サイトは、日本語圏の利用者向けに Roblox ゲームのランキング・発見体験を提供するものです。
        </p>
        <p>
          本サイトのボタン投票機能（❤️ 好き / ⭐ お気に入り / 🔥 頼むから人来て）およびタグ投票機能は、
          <strong>運営者が独自に提供する本サイト内部の機能</strong>であり、
          Roblox が提供する評価機能・投票機能・推薦機能・Discover ランキングではありません。
          本機能による投票・評価は、本サイトの閲覧者がゲームに対して付与する独自の評価であり、
          Roblox のユーザーアカウントを代理する操作ではなく、Roblox 側へ送信されることもありません。
        </p>
        <p>
          ⭐ お気に入りは「マイリスト」としても機能します。マイリストの内容は本人のみが閲覧可能です。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第4条（アカウント）</h2>
        <p>
          本サイトの一部機能（投票・マイリスト・タグ付け・ご意見投稿等）の利用にはアカウント登録が必要です。
          アカウント登録には Supabase Authentication（メール送信による Magic Link 方式）を利用します。
        </p>
        <p>
          本サイトは Roblox アカウントとの連携機能を提供しません。Roblox のログイン情報・パスワード・
          <code>.ROBLOSECURITY</code> Cookie・アクセストークン等を入力する必要はなく、入力することもおやめください。
        </p>
        <p>
          利用者は自身のアカウント情報を適切に管理する責任を負います。アカウントの不正利用が判明した場合、
          運営者は予告なく当該アカウントを停止することがあります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第5条（禁止行為）</h2>
        <p>利用者は、本サイトの利用にあたり以下の行為を行ってはなりません。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>自動化ツール・スクリプト・bot 等を用いた大量投票、投票操作、荒らし行為</li>
          <li>複数アカウントによる同一対象への重複投票（投票水増し）</li>
          <li>他者になりすます行為、および他者の権利を侵害する行為</li>
          <li>本サイトの運営を妨げる行為、不正アクセス、過度な負荷を与える行為</li>
          <li>本サイトから取得した情報の商用再配信（Roblox のサブライセンス範囲を超える利用）</li>
          <li>本サイトのデータを生成 AI・機械学習モデルの訓練用データセットとして利用する行為</li>
          <li>本サイトを Roblox 公式と誤認させる表現での外部紹介・SNS 投稿</li>
          <li>攻略・コツ投稿欄その他の投稿機能を利用した、他者への誹謗中傷・差別的表現・脅迫・つきまとい</li>
          <li>チート・ハック・不正ツール・課金代行等の斡旋、または外部サイトへの誘導を目的とするスパム投稿</li>
          <li>虚偽の攻略情報その他、他の利用者を誤導する目的での投稿</li>
          <li>本サイトの投稿が Roblox 公式の攻略・推薦であるかのように誤認させる行為</li>
          <li>法令または公序良俗に反する行為</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第6条（投稿コンテンツ）</h2>
        <p>
          利用者が本サイトに投稿したコンテンツ（タグ投票、攻略・コツ投稿（攻略Tips）、ご意見投稿、自薦プロフィール等）について、
          運営者は本サイトの運営および紹介・宣伝のために、世界中で無償・非独占的に利用する権利を取得します。
          ただし、運営者はこの権利を生成 AI・機械学習モデルの訓練データへの投入には行使しません。
        </p>
        <p>
          利用者は、自身の投稿コンテンツが第三者の権利を侵害していないことを保証するものとします。
          投稿コンテンツが本規約または法令に違反すると運営者が判断した場合、
          運営者は予告なく当該コンテンツを削除または非表示にすることができます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第6条の2（攻略・コツ投稿に関する特則）</h2>
        <p>
          本サイトのゲーム詳細ページに設けた「みんなの攻略・コツ」欄（以下「攻略・コツ投稿」）は、
          利用者が各ゲームの攻略情報・コツを相互に共有するためのユーザー投稿欄です。
          投稿される内容は各利用者が投稿するものであって、
          <strong>Roblox Corporation が提供・公認・推薦する攻略情報ではありません</strong>。
          攻略・コツ投稿は、各利用者が自ら作成した文章である必要があり、
          Roblox のゲーム説明文その他の第三者の著作物を翻訳・転載したものであってはなりません。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>攻略・コツ投稿は、アカウント登録なし（匿名）でも投稿できます。投稿できるのはテキストのみで、画像は投稿できません。</li>
          <li>
            投稿は事前審査を経ず即時に公開されます。運営者は自動フィルタ（禁止語チェック）・利用者からの通報・事後の目視確認により事後的にモデレーションを行い、
            一定数の通報があった投稿は自動的に非表示となる場合があります。
          </li>
          <li>
            利用者は、自身の攻略・コツ投稿の内容が第三者の権利（著作権・商標権・プライバシー権・名誉権等）を侵害しないこと、
            および虚偽・有害な情報でないことについて自ら責任を負います。
          </li>
          <li>攻略・コツ投稿に、Roblox その他第三者のゲーム内テキスト・説明文・画像等を無断で転載してはなりません。</li>
          <li>
            運営者は、発信者情報開示請求その他の法的手続きに対応するため、攻略・コツ投稿の送信時にアクセス元の IP アドレス等を、
            投稿本文とは分離した記録として一定期間保管します（収集する情報・保管期間・取扱いの詳細は
            <Link href="/privacy" className="underline">プライバシーポリシー</Link>に定めます）。
            当該情報は、法令に基づく正当な手続きがある場合に限り開示の対象となります。
          </li>
          <li>本規約または法令に違反する攻略・コツ投稿、および本サイトの趣旨に著しく反する投稿について、運営者は予告なく非表示または削除することができます。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第7条（広告）</h2>
        <p>
          本サイトでは将来、運営費を賄うため第三者広告配信事業者（Google AdSense 等）による広告を表示する場合があります。
          表示される広告には「📢 広告」または「PR」のラベルを明示し、ランキング・推薦・ピックアップの順位とは無関係であることを表記します。
        </p>
        <p>
          本サイトは広告主から金銭を受け取ってゲームを上位表示すること、特定のクリエイターを優遇することは行いません。
          本サイトのランキングは利用者の投票と Roblox の公開データに基づき機械的に算出されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第8条（免責）</h2>
        <p>
          本サイトは情報提供のみを目的としており、掲載情報の正確性・完全性・最新性について保証するものではありません。
          本サイトの利用により利用者に生じた損害について、運営者は責任を負いません。
          ただし、運営者の故意または重過失によって生じた損害については、この限りではありません。
        </p>
        <p>
          Roblox プラットフォーム上のゲーム・サービスの可用性・内容については Roblox Corporation または各ゲームの運営者が責任を負うものであり、本サイトの運営者は関与しません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第9条（削除申請）</h2>
        <p>
          自身の権利が本サイト上で侵害されていると考える権利者の方、および掲載情報について削除を希望される方は、
          <Link href="/contact" className="underline">お問い合わせ・削除申請ページ</Link>よりご連絡ください。
          運営者は一次対応を24時間以内、最終対応を14日以内に行うことを目標とし、正当な申請については速やかに対応します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第10条（規約の変更）</h2>
        <p>
          運営者は、必要と判断した場合、利用者への事前の通知なく本規約を変更できるものとします。
          重要な変更がある場合は、本サイト上で事前に告知します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第11条（準拠法・管轄）</h2>
        <p>
          本規約は日本法に準拠します。本サイトに関して運営者と利用者の間に紛争が生じた場合、
          東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          ただし、日本国内の消費者として利用される方との紛争については、
          消費者契約法その他の法令により認められる裁判所で提起することを妨げません。
        </p>
      </section>

      <section className="space-y-2 text-[12px] text-muted-foreground border-t border-border pt-4">
        <p>
          本規約に関する不明点は <Link href="/contact" className="underline">お問い合わせ</Link> までご連絡ください。
          関連文書：<Link href="/privacy" className="underline">プライバシーポリシー</Link>。
        </p>
      </section>
    </main>
  );
}
