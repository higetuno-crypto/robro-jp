import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約 | Roblox Japan Ranking',
  description: '本サイトの利用規約',
};

// NOTE: 文面は Yuki 最終確認前提の雛形。運営者名は後で差し替え（プレースホルダー「運営者」）。

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-3 py-6 text-[14px] leading-relaxed space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold">利用規約</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">最終更新日：2026年4月24日</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第1条（適用）</h2>
        <p>
          本規約は、本サイトの運営者（以下「運営者」）が提供する本サイトのすべての機能の利用について、
          運営者と利用者との間に適用されます。本サイトを利用することにより、利用者は本規約に同意したものとみなします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第2条（Roblox Corporation との関係）</h2>
        <p>
          本サイトは Roblox Corporation の公式サービスではありません。運営者は Roblox Corporation
          およびその関連会社（日本国内における契約当事者は Roblox 合同会社）とは一切関係がなく、
          提携・認定・後援を受けているものでもありません。
        </p>
        <p>
          本サイトに掲載するゲーム情報・サムネイル画像等は、Roblox が公開する API および公開ページから取得した情報を
          独自に編集したものです。各ゲームの著作権・商標権その他の権利は、Roblox Corporation および各ゲームの権利者に帰属します。
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
          本サイトのタグ投票機能は、運営者が独自に提供する機能であり、Roblox が提供する投票・評価機能ではありません。
          本機能による投票は、本サイトの閲覧者がゲームに対して付与するものであり、Roblox のユーザーを代理するものではありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第4条（禁止行為）</h2>
        <p>利用者は、本サイトの利用にあたり以下の行為を行ってはなりません。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>自動化ツール・スクリプト等を用いた大量投票、投票操作、荒らし行為</li>
          <li>他者になりすます行為、および他者の権利を侵害する行為</li>
          <li>本サイトの運営を妨げる行為、不正アクセス、過度な負荷を与える行為</li>
          <li>本サイトから取得した情報の商用再配信（Roblox のサブライセンス範囲を超える利用）</li>
          <li>本サイトのデータを AI・機械学習モデルの訓練用データセットとして利用する行為</li>
          <li>法令または公序良俗に反する行為</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第5条（免責）</h2>
        <p>
          本サイトは情報提供のみを目的としており、掲載情報の正確性・完全性・最新性について保証するものではありません。
          本サイトの利用により利用者に生じた損害について、運営者は責任を負いません。
          ただし、運営者の故意または重過失によって生じた損害については、この限りではありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第6条（削除申請）</h2>
        <p>
          自身の権利が本サイト上で侵害されていると考える権利者の方、および掲載情報について削除を希望される方は、
          <a href="/contact" className="underline">お問い合わせ・削除申請ページ</a>よりご連絡ください。
          運営者は一次対応を24時間以内に行うことを目標とし、正当な申請については速やかに対応します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第7条（規約の変更）</h2>
        <p>
          運営者は、必要と判断した場合、利用者への事前の通知なく本規約を変更できるものとします。
          重要な変更がある場合は、本サイト上で事前に告知します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold">第8条（準拠法・管轄）</h2>
        <p>
          本規約は日本法に準拠します。本サイトに関して運営者と利用者の間に紛争が生じた場合、
          東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          ただし、日本国内の消費者として利用される方との紛争については、
          消費者契約法その他の法令により認められる裁判所で提起することを妨げません。
        </p>
      </section>
    </main>
  );
}
