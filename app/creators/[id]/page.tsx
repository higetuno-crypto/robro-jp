import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase-ssr';
import { getCreatorById, listCreatorGames, toPublic } from '@/lib/creators';
import { ReportButton } from '@/components/ReportButton';

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return { title: 'クリエイターが見つかりません' };
  const ssrSupa = await createSupabaseServerClient();
  const creator = await getCreatorById(ssrSupa, id).catch(() => null);
  if (!creator || !creator.is_verified) {
    return { title: 'クリエイター', robots: { index: false } };
  }
  const pub = toPublic(creator);
  const desc = pub.self_introduction
    ? pub.self_introduction.replace(/\s+/g, ' ').slice(0, 160)
    : `${pub.display_name} の Roblox クリエイタープロフィール（robro-jp 確認済み）。`;
  const url = `https://ro-brojp.com/creators/${id}`;
  return {
    title: pub.display_name,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${pub.display_name} | ro-brojp`,
      description: desc,
      url,
      type: 'profile',
      images: pub.avatar_url ? [{ url: pub.avatar_url }] : undefined,
      locale: 'ja_JP',
    },
  };
}

/**
 * /creators/[id] クリエイター詳細ページ（フェーズ10）
 *
 * 公開条件：
 *  - is_verified=TRUE：誰でも閲覧可
 *  - is_verified=FALSE：本人のみプレビュー可
 */

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  twitch: 'Twitch',
  blog: 'Blog',
};

export default async function CreatorDetailPage(props: PageProps) {
  const params = await props.params;
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  // verified 行は anon でも見えるが、未verified 行は本人セッションでしか見えない
  // → SSR クライアント（cookieベース）で取得して RLS の本人ポリシーを適用
  const ssrSupa = await createSupabaseServerClient();
  const creator = await getCreatorById(ssrSupa, id);
  if (!creator) notFound();

  const isPublic = creator.is_verified;
  let canPreview = false;
  if (!isPublic) {
    const user = await getCurrentUser();
    canPreview = !!user && user.id === creator.account_id;
    if (!canPreview) notFound();
  }

  const pub = toPublic(creator);
  const games = await listCreatorGames(ssrSupa, id);

  const personLd = isPublic
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: pub.display_name,
        url: `https://ro-brojp.com/creators/${id}`,
        image: pub.avatar_url ?? undefined,
        description: pub.self_introduction ?? undefined,
        sameAs: [
          pub.roblox_profile_url,
          ...pub.social_links.map((sl) => sl.url),
        ].filter(Boolean),
      }
    : null;

  return (
    <main className="max-w-3xl mx-auto px-3 py-4">
      {personLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
        />
      )}
      {!isPublic && canPreview ? (
        <div className="mb-4 border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[12px]">
          このプロフィールは未確認状態です。本人のみ閲覧できます。
          <Link href="/creators/register" className="underline ml-1">
            確認手続きを進める →
          </Link>
        </div>
      ) : null}
      <header className="flex items-start gap-4">
        <div className="w-20 h-20 shrink-0 bg-muted overflow-hidden">
          {pub.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            (<img
              src={pub.avatar_url}
              alt={pub.display_name}
              className="w-full h-full object-cover"
            />)
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-semibold flex items-center gap-1">
            <span className="truncate">{pub.display_name}</span>
            {isPublic ? (
              <span
                className="text-[12px] text-muted-foreground"
                title="Roblox プロフィール照合で確認済み"
              >
                ✓
              </span>
            ) : null}
          </h1>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            <a
              href={pub.roblox_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Roblox プロフィール
            </a>
          </div>
          {pub.social_links.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
              {pub.social_links.map((sl, i) => (
                <a
                  key={`${sl.platform}-${i}`}
                  href={sl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {PLATFORM_LABELS[sl.platform] ?? sl.platform}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      {pub.self_introduction ? (
        <section className="mt-6 text-[13px] whitespace-pre-wrap leading-relaxed">
          {pub.self_introduction}
        </section>
      ) : null}
      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">代表作</h2>
        {games.length === 0 ? (
          <p className="text-[12px] text-muted-foreground mt-2">
            まだ代表作は登録されていません。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {games.map((g) => (
              <li key={g.universe_id}>
                <Link
                  href={`/game/${g.universe_id}`}
                  className="flex items-center gap-3 py-2 hover:bg-muted/40 px-1"
                >
                  <div className="w-12 h-12 shrink-0 bg-muted overflow-hidden">
                    {g.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      (<img
                        src={g.thumbnail_url}
                        alt={g.name}
                        className="w-full h-full object-cover"
                      />)
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate flex items-center gap-1">
                      {g.is_primary ? (
                        <span className="text-[10px] border border-border px-1 py-0 leading-4 text-muted-foreground">
                          代表作
                        </span>
                      ) : null}
                      <span className="truncate">{g.name}</span>
                    </div>
                    {g.creator_name ? (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {g.creator_name}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isPublic ? (
        <div className="mt-6 text-right">
          <ReportButton targetType="creator" targetId={pub.id} />
        </div>
      ) : null}
      <p className="mt-10 text-[10px] text-muted-foreground">
        本人確認は、{pub.display_name}
        さんが Roblox プロフィールに一時掲載した確認コードを公開 users API で照合して行いました。
        パスワード・<code className="font-mono">.ROBLOSECURITY</code> Cookie・アクセストークンの入力は求めていません。
      </p>
    </main>
  );
}
