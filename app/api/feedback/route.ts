import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createBrowserClient, createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { makeFingerprint } from '@/lib/tags';
import { moderateText, hasBlockingIssue } from '@/lib/moderation';
import {
  fetchFeedbackPosts,
  countRecentPosts,
  createFeedbackPost,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackListOptions,
} from '@/lib/feedback';

/**
 * GET  /api/feedback  → 投稿一覧
 * POST /api/feedback  → 新規投稿（ログイン必須）
 *
 * レートリミット：
 *  - 同一アカウント = 60秒に1件、1日に3件
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT_PER_MINUTE = 1;
const LIMIT_PER_DAY = 3;

const VALID_SORTS = ['popular', 'new'] as const;
const VALID_STATUSES: FeedbackStatus[] = [
  'open', 'under_review', 'planned', 'in_progress', 'done', 'declined', 'duplicate',
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sortRaw = url.searchParams.get('sort');
  const statusRaw = url.searchParams.get('status');
  const categoryRaw = url.searchParams.get('category');

  const opts: FeedbackListOptions = {
    sort: (VALID_SORTS as readonly string[]).includes(sortRaw ?? '')
      ? (sortRaw as 'popular' | 'new')
      : 'popular',
    status:
      statusRaw === 'all'
        ? 'all'
        : VALID_STATUSES.includes(statusRaw as FeedbackStatus)
        ? (statusRaw as FeedbackStatus)
        : 'all',
    category:
      categoryRaw === 'all'
        ? 'all'
        : FEEDBACK_CATEGORIES.some((c) => c.key === categoryRaw)
        ? (categoryRaw as FeedbackCategory)
        : 'all',
    limit: 100,
  };

  try {
    const supabase = createBrowserClient();
    const posts = await fetchFeedbackPosts(supabase, opts);
    return NextResponse.json({ posts });
  } catch (e) {
    console.error('[api/feedback GET]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = parsePostBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // モデレーション（ブロック語があれば差し戻し）
  const titleIssues = moderateText(parsed.title);
  const bodyIssues = moderateText(parsed.body);
  if (hasBlockingIssue(titleIssues) || hasBlockingIssue(bodyIssues)) {
    return NextResponse.json(
      {
        error: 'moderation_block',
        issues: { title: titleIssues, body: bodyIssues },
      },
      { status: 422 }
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = makeFingerprint(ip, ua);

  const supabase = createServiceClient();

  const { last60s, last24h } = await countRecentPosts(supabase, user.id);
  if (last60s >= LIMIT_PER_MINUTE || last24h >= LIMIT_PER_DAY) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded', last60s, last24h },
      { status: 429 }
    );
  }

  try {
    const post = await createFeedbackPost(supabase, {
      title: parsed.title,
      body: parsed.body,
      category: parsed.category,
      accountId: user.id,
      fingerprint,
    });
    revalidatePath('/feedback');
    return NextResponse.json({ post });
  } catch (e) {
    console.error('[api/feedback POST]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

function parsePostBody(
  body: unknown
):
  | { title: string; body: string; category: FeedbackCategory }
  | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid body' };
  const b = body as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const text = typeof b.body === 'string' ? b.body.trim() : '';
  const category = typeof b.category === 'string' ? b.category : '';

  if (title.length < 5 || title.length > 80) {
    return { error: 'title must be 5-80 chars' };
  }
  if (text.length < 10 || text.length > 2000) {
    return { error: 'body must be 10-2000 chars' };
  }
  if (!FEEDBACK_CATEGORIES.some((c) => c.key === category)) {
    return { error: 'invalid category' };
  }
  return { title, body: text, category: category as FeedbackCategory };
}
