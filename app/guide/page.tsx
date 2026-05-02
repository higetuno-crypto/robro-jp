import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'このサイトの使い方',
  description:
    'ro-brojp の使い方ガイド。Googleアカウントの作り方、タグの付け方、配信ネタの探し方、ご意見の送り方を解説します。',
};

/**
 * /guide — 初めての方向けチュートリアル。
 *
 * UI思想：ランキングページの淡々トーンではなく、ピックアップ寄りの温かいトーン。
 * カード型・章立てで若年層にも読みやすく。スクショは後日追加。
 */
export default function GuidePage() {
  return (
    <main className="max-w-3xl mx-auto px-3 py-6 text-[14px] leading-relaxed space-y-8">
      <header className="space-y-2">
        <h1 className="text-[22px] font-semibold">このサイトの使い方</h1>
        <p className="text-[13px] text-muted-foreground">
          ro-brojp は、日本語ユーザー向けの Roblox ゲーム発見サイトです。
          初めての方でも迷わないように、主な使い方をまとめました（5分で読めます）。
        </p>
      </header>

      <Section title="① このサイトでできること">
        <ul className="list-disc pl-6 space-y-1">
          <li>日本で人気の Roblox ゲームがリアルタイムで分かる</li>
          <li>「配信向き」「英語不要」などのタグで目的別に探せる</li>
          <li>配信者向けの「今夜のネタ」を用途別に探せる（<Link href="/stream" className="underline">/stream</Link>）</li>
          <li>気に入ったゲームにタグを付けて、他の人の発見を助けられる</li>
          <li>サイトへのご意見・要望を送って投票できる</li>
        </ul>
      </Section>

      <Section title="② Googleアカウントの作り方（持っていない方へ）">
        <p>
          タグ投票やご意見投稿には Google アカウントでのログインが必要です。
          まだ持っていない方は、以下の手順で無料で作れます。
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Google のアカウント作成ページ（
            <a
              href="https://accounts.google.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              accounts.google.com/signup
            </a>
            ）にアクセス
          </li>
          <li>名前・生年月日・性別を入力（ニックネームでもOK）</li>
          <li>ユーザー名（メールアドレスになる部分）とパスワードを決める</li>
          <li>電話番号で本人確認（任意だが推奨）</li>
          <li>利用規約に同意して完了</li>
        </ol>
        <p className="text-[13px] text-muted-foreground">
          ※ 13歳未満の方は保護者の同意のもとで作成してください。
          Google のファミリーリンク機能を使うと、保護者が管理しながら子ども用アカウントを作れます。
        </p>
      </Section>

      <Section title="③ ログインの仕方">
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            右上のメニュー、または
            <Link href="/login" className="underline mx-1">ログインページ</Link>
            を開く
          </li>
          <li>「Google でログイン」ボタンを押す</li>
          <li>Google の画面でアカウントを選ぶ</li>
          <li>許可を求められたら「許可」を押す</li>
          <li>ro-brojp に戻ってきたらログイン完了</li>
        </ol>
        <p className="text-[13px] text-muted-foreground">
          ※ ro-brojp は Google アカウントのメールアドレスと表示名以外の情報を取得しません。
          詳しくは<Link href="/privacy" className="underline mx-1">プライバシーポリシー</Link>をご覧ください。
        </p>
      </Section>

      <Section title="④ タグの付け方">
        <p>
          タグは「このゲームはこういう遊び方ができる」という目印です。
          ユーザー同士で付け合うことで、日本語で探しやすいカタログが育ちます。
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>気に入ったゲームの詳細ページを開く</li>
          <li>タグ一覧の下にある「タグを付ける」ボタンを押す</li>
          <li>プールから最大5件まで選んで決定</li>
        </ol>
        <p className="text-[13px] text-muted-foreground">
          ※ 同じゲームの同じタグには24時間に1票まで。
          荒らし防止のため、1日の投票数にも上限があります。
          自由入力のタグは現在受け付けていません（運営が選んだプールから選択）。
        </p>
      </Section>

      <Section title="⑤ 配信ネタを探している方へ">
        <p>
          ヘッダーの「配信」タブ、または
          <Link href="/stream" className="underline mx-1">/stream</Link>
          に「今夜の配信ネタ」を6つの用途別に分けた入口があります。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>コラボ向き</strong> — 複数人配信で映える</li>
          <li><strong>視聴者参加</strong> — 配信者と視聴者で遊べる</li>
          <li><strong>短時間</strong> — 1プレイが短くて枠に収まる</li>
          <li><strong>リアクション</strong> — 初見の驚きで見せる</li>
          <li><strong>英語不要</strong> — 日本語ユーザーでも操作で困らない</li>
          <li><strong>叫ぶ系</strong> — 声出し配信で盛り上がる</li>
        </ul>
        <p>
          各ゲームの詳細ページには、配信向きゲームなら「配信向けメタ情報」パネルが表示されます。
          一言ピッチ・最初の10分・注意点（英語依存度・BGM・年齢感）が事前に分かります。
          気に入ったらシェアカードボタンで X にそのまま共有できます。
        </p>
      </Section>

      <Section title="⑥ ご意見・要望の送り方">
        <p>
          サイトをもっと良くするためのアイデア、不具合の報告、追加してほしい機能などは
          <Link href="/feedback" className="underline mx-1">ご意見・要望ボード</Link>
          から投稿・投票できます。投票が集まった要望から順番に運営が検討・対応します。
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>ログインした状態で <Link href="/feedback" className="underline">/feedback</Link> を開く</li>
          <li>「＋ 新しいご意見・要望を投稿する」を押す</li>
          <li>タイトル（5〜80字）・種別・本文（10〜2000字）を入力して投稿</li>
          <li>他の人の投稿にも ▲ を押して投票できる（1アカウント1票、取り消し可）</li>
        </ol>
        <p className="text-[13px] text-muted-foreground">
          ※ 個別に返信が必要な削除申請・お問い合わせは
          <Link href="/contact" className="underline mx-1">お問い合わせページ</Link>
          からメールでご連絡ください。
        </p>
      </Section>

      <Section title="⑦ 困ったときは">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            掲載情報の削除申請・プライバシーに関するご請求：
            <Link href="/contact" className="underline mx-1">お問い合わせ</Link>
          </li>
          <li>
            データの取り扱いについて：
            <Link href="/privacy" className="underline mx-1">プライバシーポリシー</Link>
          </li>
          <li>
            利用にあたってのルール：
            <Link href="/terms" className="underline mx-1">利用規約</Link>
          </li>
        </ul>
      </Section>

      <footer className="pt-4 border-t border-border text-[12px] text-muted-foreground">
        分からないことがあれば
        <Link href="/contact" className="underline mx-1">お問い合わせ</Link>
        からご連絡ください。ガイドへの追加要望も歓迎です。
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
