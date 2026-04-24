import Link from 'next/link';

/**
 * FE-08「目的別で選ぶ」セクション。
 *
 * CLAUDE.md の ro-bro 哲学：「面白さの通訳」＝数字比較ではなく、
 * 「何が面白いか・誰向けか・英語不要か・配信向きか」を日本語で提示する。
 * その哲学が最も端的に出る場所。
 *
 * UI原則：ランキング側の淡々としたトーンに合わせ、装飾は最小。
 * 各カードは対応する公式タグの /tags/[slug] へリンク。
 */

interface Purpose {
  slug: string;
  title: string;
  subtitle: string;
}

const PURPOSES: Purpose[] = [
  { slug: 'easy_rule',     title: '初めてのRobloxならこれ', subtitle: 'ルールが直感で分かる' },
  { slug: 'no_english',    title: '英語ほぼ不要',           subtitle: 'UIもルールも日本語で遊べる' },
  { slug: 'collab_good',   title: '友達とワイワイ',         subtitle: 'コラボ向き・人数で化ける' },
  { slug: 'solo_ok',       title: 'ソロでも楽しい',         subtitle: '1人プレイでちゃんと刺さる' },
  { slug: 'short_play',    title: 'サクッと短時間',         subtitle: '1プレイが短くて区切れる' },
  { slug: 'stream_good',   title: '配信ネタに',             subtitle: '配信で映える・画になる' },
];

export function PurposePicker() {
  return (
    <div className="border-b border-border px-3 py-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[13px] font-medium">目的別で選ぶ</div>
        <Link href="/tags" className="text-[12px] text-muted-foreground hover:underline">
          すべてのタグ →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PURPOSES.map((p) => (
          <Link
            key={p.slug}
            href={`/tags/${p.slug}`}
            className="block border border-border bg-card hover:bg-muted/40 px-3 py-2"
          >
            <div className="text-[13px] font-medium leading-tight">{p.title}</div>
            <div className="text-[11px] text-muted-foreground truncate">{p.subtitle}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
