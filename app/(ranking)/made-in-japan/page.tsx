import Link from 'next/link';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { getJapaneseCreatorGames } from '@/lib/japan-creators-query';
import { RankingRow } from '@/components/RankingRow';
import { formatRelativeJa } from '@/lib/format';

/**
 * 日本制作（/made-in-japan）
 *
 * CLAUDE.md：
 * - このサイトの独自性の核。「数字の翻訳」ではなく「本物の日本人クリエイター発見」。
 * - 推定型 is_japanese（母数17件）でも name_ja（自動翻訳で汚染）でもなく、
 *   ベース名 or 制作者名が日本語、という確実なシグナルで日本制作を抽出する。
 * - 並びは「にぎわい優先ハイブリッド」。詳細は lib/japan-creators-query.ts。
 * - 行は共通 RankingRow を流用（1位も最下位も同じ見た目・装飾なしの原則）。
 * - revalidate = 300
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: '日本制作のRobloxゲーム',
  description:
    '日本人クリエイターが作った Roblox ゲームを発見。タイトルや制作者名が日本語のゲームだけを集めました。英語に埋もれがちな個人開発ゲームを日本語ファーストで紹介します。',
  alternates: { canonical: 'https://ro-brojp.com/made-in-japan' },
  openGraph: {
    title: '日本制作のRobloxゲーム | ロブランキング',
    description:
      '日本人クリエイターが作った Roblox ゲームを発見。英語に埋もれがちな個人開発ゲームを日本語ファーストで。',
    url: 'https://ro-brojp.com/made-in-japan',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'ロブランキング',
  },
};

export default async function MadeInJapanPage() {
  const supabase = createBrowserClient();
  const { rows, capturedAt, total } = await getJapaneseCreatorGames(supabase, 100);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '日本制作のRobloxゲーム',
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 50).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ro-brojp.com/game/${r.universeId}`,
      name: r.name,
    })),
  };

  return (
    <section>
      <script
        type="application/ld+json"
        // ゲーム名は Roblox 由来（誰でも命名可）なので </script> 注入を防ぐため < をエスケープ
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ページ説明 */}
      <div className="border-b border-border px-3 py-3">
        <h1 className="text-[15px] font-medium">日本制作のRobloxゲーム</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          日本のクリエイターが作ったゲーム（タイトルまたは制作者名が日本語）だけを集めました。
          英語タイトルに埋もれて公式検索では見つけにくい個人開発ゲームを、日本語で発見できます。
        </p>
      </div>

      {/* 更新時刻・件数 */}
      <div className="px-3 py-2 text-[13px] text-muted-foreground">
        {rows.length === 0
          ? 'まだ登録がありません。'
          : capturedAt
          ? `${formatRelativeJa(capturedAt)} ・ にぎわい順 ・ 全${total}件`
          : `にぎわい順 ・ 全${total}件`}
      </div>

      <div>
        {rows.map((r) => (
          <RankingRow key={r.universeId} row={r} />
        ))}
      </div>

      {/* CCU 表記の補足 + 投稿導線（母数を育てる） */}
      <div className="border-t border-border px-3 py-5 mt-2">
        <div className="text-[13px] leading-relaxed text-muted-foreground">
          <p>
            CCU が「-」のゲームはランキング集計対象外のため現在の同時接続数を取得していません
            （新着順で下に並びます）。
          </p>
          <p className="mt-2">
            知っている日本制作ゲームがここに無いですか？
            ぜひ教えてください。掲載していきます。
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/feedback"
            className="inline-block text-[13px] underline hover:no-underline"
          >
            → 日本制作ゲームを教える / 要望を送る
          </Link>
          <Link
            href="/search"
            className="inline-block text-[13px] text-muted-foreground underline hover:no-underline"
          >
            ゲームを検索する
          </Link>
        </div>
      </div>
    </section>
  );
}
