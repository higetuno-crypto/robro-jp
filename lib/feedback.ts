import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * フェーズ8.5：ご意見ボード（Fider/Canny風）のヘルパー
 *
 * - 投稿・投票はログイン必須（Supabase Auth / Google）
 * - fingerprint は多重アカウント荒らし検知の補助
 * - vote_count は feedback_votes からの集計キャッシュ（write 時にロール更新）
 * - 自由入力は受け付けるが moderation.ts でブロック語チェック
 */

export type FeedbackCategory = 'bug' | 'idea' | 'content' | 'ui' | 'other';
export type FeedbackStatus =
  | 'open'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'declined'
  | 'duplicate';

export const FEEDBACK_CATEGORIES: { key: FeedbackCategory; label: string }[] = [
  { key: 'bug', label: '不具合' },
  { key: 'idea', label: 'アイデア' },
  { key: 'content', label: 'コンテンツ要望' },
  { key: 'ui', label: 'UI改善' },
  { key: 'other', label: 'その他' },
];

export const FEEDBACK_STATUSES: { key: FeedbackStatus; label: string; tone: string }[] = [
  { key: 'open',         label: '受付中',     tone: 'text-muted-foreground' },
  { key: 'under_review', label: '検討中',     tone: 'text-amber-600' },
  { key: 'planned',      label: '実装予定',   tone: 'text-blue-600' },
  { key: 'in_progress',  label: '着手中',     tone: 'text-purple-600' },
  { key: 'done',         label: '完了',       tone: 'text-green-600' },
  { key: 'declined',     label: '見送り',     tone: 'text-muted-foreground' },
  { key: 'duplicate',    label: '重複',       tone: 'text-muted-foreground' },
];

export interface FeedbackPost {
  id: number;
  title: string;
  body: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
  authorAccountId: string;
  authorName: string | null;
  duplicateOf: number | null;
}

export interface FeedbackListOptions {
  sort?: 'popular' | 'new';
  status?: FeedbackStatus | 'all';
  category?: FeedbackCategory | 'all';
  limit?: number;
}

interface PostRow {
  id: number;
  title: string;
  body: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  vote_count: number;
  created_at: string;
  updated_at: string;
  author_account_id: string;
  duplicate_of: number | null;
  accounts: { display_name: string | null } | null;
}

export async function fetchFeedbackPosts(
  supabase: SupabaseClient,
  opts: FeedbackListOptions = {}
): Promise<FeedbackPost[]> {
  const sort = opts.sort ?? 'popular';
  const limit = opts.limit ?? 100;

  let q = supabase
    .from('feedback_posts')
    .select(
      `id, title, body, category, status, vote_count, created_at, updated_at,
       author_account_id, duplicate_of,
       accounts:author_account_id ( display_name )`
    )
    .eq('is_hidden', false);

  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
  if (opts.category && opts.category !== 'all') q = q.eq('category', opts.category);

  if (sort === 'popular') {
    q = q.order('vote_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    q = q.order('created_at', { ascending: false });
  }

  const { data, error } = await q.limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as PostRow[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    status: r.status,
    voteCount: r.vote_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorAccountId: r.author_account_id,
    authorName: r.accounts?.display_name ?? null,
    duplicateOf: r.duplicate_of,
  }));
}

/** ログイン中ユーザーが投票済みの post_id セットを取得 */
export async function fetchUserVotedPostIds(
  supabase: SupabaseClient,
  accountId: string
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('feedback_votes')
    .select('post_id')
    .eq('account_id', accountId);
  if (error) throw error;
  return new Set(((data ?? []) as { post_id: number }[]).map((r) => r.post_id));
}

/** account_id の直近投稿数（レートリミット：60秒1件、1日3件） */
export async function countRecentPosts(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ last60s: number; last24h: number }> {
  const now = Date.now();
  const since60 = new Date(now - 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 3600 * 1000).toISOString();

  const { count: c60, error: e60 } = await supabase
    .from('feedback_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_account_id', accountId)
    .gte('created_at', since60);
  if (e60) throw e60;

  const { count: c24, error: e24 } = await supabase
    .from('feedback_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_account_id', accountId)
    .gte('created_at', since24);
  if (e24) throw e24;

  return { last60s: c60 ?? 0, last24h: c24 ?? 0 };
}

/** 投票トグル：既に投票済みなら取り消し、未投票なら追加。vote_count を同期。 */
export async function toggleVote(
  supabase: SupabaseClient,
  params: { postId: number; accountId: string; fingerprint: string }
): Promise<{ voted: boolean; voteCount: number }> {
  const { postId, accountId, fingerprint } = params;

  // 既存投票を確認
  const { data: existing, error: selErr } = await supabase
    .from('feedback_votes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    // 取り消し
    const { error: delErr } = await supabase
      .from('feedback_votes')
      .delete()
      .eq('post_id', postId)
      .eq('account_id', accountId);
    if (delErr) throw delErr;
  } else {
    // 追加
    const { error: insErr } = await supabase.from('feedback_votes').insert({
      post_id: postId,
      account_id: accountId,
      fingerprint,
    });
    if (insErr) throw insErr;
  }

  // vote_count を集計から再計算（整合性優先。将来RPC化候補）
  const { count, error: cErr } = await supabase
    .from('feedback_votes')
    .select('post_id', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (cErr) throw cErr;

  const newCount = count ?? 0;
  const { error: upErr } = await supabase
    .from('feedback_posts')
    .update({ vote_count: newCount, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (upErr) throw upErr;

  return { voted: !existing, voteCount: newCount };
}

/** 投稿作成 */
export async function createFeedbackPost(
  supabase: SupabaseClient,
  params: {
    title: string;
    body: string;
    category: FeedbackCategory;
    accountId: string;
    fingerprint: string;
  }
): Promise<FeedbackPost> {
  const { data, error } = await supabase
    .from('feedback_posts')
    .insert({
      title: params.title,
      body: params.body,
      category: params.category,
      author_account_id: params.accountId,
      author_fingerprint: params.fingerprint,
    })
    .select(
      `id, title, body, category, status, vote_count, created_at, updated_at,
       author_account_id, duplicate_of,
       accounts:author_account_id ( display_name )`
    )
    .single();
  if (error) throw error;

  const r = data as unknown as PostRow;
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    status: r.status,
    voteCount: r.vote_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorAccountId: r.author_account_id,
    authorName: r.accounts?.display_name ?? null,
    duplicateOf: r.duplicate_of,
  };
}
