import type { Metadata } from 'next';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import {
  fetchFeedbackPosts,
  fetchUserVotedPostIds,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackListOptions,
} from '@/lib/feedback';
import { FeedbackComposer } from './FeedbackComposer';
import { FeedbackRow } from './FeedbackRow';

/**
 * /feedback — サイトご意見・要望ボード
 *
 * UI思想：ランキングページの淡々トーン寄り。ただしアクション（投票・投稿）は
 * 明確に見えるように。Fider/Canny のミニマル版。
 */

export const metadata: Metadata = {
  title: 'ご意見・要望ボード | Roblox Japan Ranking',
  description:
    'robro-jp へのご意見・要望を投稿・投票できます。投票が集まった要望から順番に運営が検討・対応します。',
};

export const dynamic = 'force-dynamic';

const VALID_SORTS = ['popular', 'new'] as const;
type Sort = (typeof VALID_SORTS)[number];

interface PageProps {
  searchParams: {
    sort?: string;
    status?: string;
    category?: string;
  };
}

export default async function FeedbackPage({ searchParams }: PageProps) {
  const sort: Sort = (VALID_SORTS as readonly string[]).includes(searchParams.sort ?? '')
    ? (searchParams.sort as Sort)
    : 'popular';

  const status: FeedbackStatus | 'all' =
    searchParams.status === 'all' || !searchParams.status
      ? 'all'
      : FEEDBACK_STATUSES.some((s) => s.key === searchParams.status)
      ? (searchParams.status as FeedbackStatus)
      : 'all';

  const category: FeedbackCategory | 'all' =
    searchParams.category === 'all' || !searchParams.category
      ? 'all'
      : FEEDBACK_CATEGORIES.some((c) => c.key === searchParams.category)
      ? (searchParams.category as FeedbackCategory)
      : 'all';

  const opts: FeedbackListOptions = { sort, status, category, limit: 100 };

  const supabase = createBrowserClient();
  const [posts, user] = await Promise.all([
    fetchFeedbackPosts(supabase, opts),
    getCurrentUser(),
  ]);

  const votedSet = user
    ? await fetchUserVotedPostIds(supabase, user.id)
    : new Set<number>();

  return (
    <main className="max-w-3xl mx-auto px-3 py-6 space-y-5">
      <header className="space-y-1">
        <h1 className="text-[20px] font-semibold">ご意見・要望ボード</h1>
        <p className="text-[12px] text-muted-foreground">
          サイトへのご意見・要望を投稿・投票できます。投票が集まった要望から運営が検討・対応します。
        </p>
      </header>

      {/* 投稿フォーム（ログイン必須） */}
      {user ? (
        <FeedbackComposer />
      ) : (
        <div className="border border-border bg-card px-3 py-3 text-[13px]">
          投稿・投票には
          <Link href="/login" className="underline mx-1">ログイン</Link>
          が必要です（Google アカウント）。
        </div>
      )}

      {/* フィルター */}
      <FilterBar sort={sort} status={status} category={category} />

      {/* 投稿一覧 */}
      <div className="border border-border">
        {posts.length === 0 ? (
          <div className="px-3 py-6 text-[13px] text-muted-foreground text-center">
            該当する投稿はまだありません。最初の1件を投稿してみませんか？
          </div>
        ) : (
          posts.map((p) => (
            <FeedbackRow
              key={p.id}
              post={p}
              voted={votedSet.has(p.id)}
              canVote={!!user}
            />
          ))
        )}
      </div>

      <footer className="text-[11px] text-muted-foreground pt-2">
        ※ 不具合報告や削除申請など、個別対応が必要な件は
        <Link href="/contact" className="underline mx-1">お問い合わせ</Link>
        をご利用ください。
      </footer>
    </main>
  );
}

function FilterBar({
  sort,
  status,
  category,
}: {
  sort: Sort;
  status: FeedbackStatus | 'all';
  category: FeedbackCategory | 'all';
}) {
  const mkHref = (patch: Partial<{ sort: Sort; status: string; category: string }>) => {
    const params = new URLSearchParams();
    const next = { sort, status, category, ...patch };
    if (next.sort !== 'popular') params.set('sort', next.sort);
    if (next.status !== 'all') params.set('status', next.status);
    if (next.category !== 'all') params.set('category', next.category);
    const q = params.toString();
    return q ? `/feedback?${q}` : '/feedback';
  };

  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
        <span className="text-muted-foreground">並び順:</span>
        <TabLink href={mkHref({ sort: 'popular' })} active={sort === 'popular'}>
          人気順
        </TabLink>
        <TabLink href={mkHref({ sort: 'new' })} active={sort === 'new'}>
          新着順
        </TabLink>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
        <span className="text-muted-foreground">状態:</span>
        <TabLink href={mkHref({ status: 'all' })} active={status === 'all'}>
          すべて
        </TabLink>
        {FEEDBACK_STATUSES.map((s) => (
          <TabLink
            key={s.key}
            href={mkHref({ status: s.key })}
            active={status === s.key}
          >
            {s.label}
          </TabLink>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
        <span className="text-muted-foreground">種別:</span>
        <TabLink href={mkHref({ category: 'all' })} active={category === 'all'}>
          すべて
        </TabLink>
        {FEEDBACK_CATEGORIES.map((c) => (
          <TabLink
            key={c.key}
            href={mkHref({ category: c.key })}
            active={category === c.key}
          >
            {c.label}
          </TabLink>
        ))}
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'font-medium underline underline-offset-2'
          : 'text-muted-foreground hover:underline'
      }
    >
      {children}
    </Link>
  );
}
