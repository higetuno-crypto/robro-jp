import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/feedback';

/**
 * PATCH /api/admin/feedback/[id]
 *   body: { status?, is_hidden?, duplicate_of? }
 *
 * Basic認証は middleware.ts で済み。/admin/* と /api/admin/* に適用。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: FeedbackStatus[] = [
  'open', 'under_review', 'planned', 'in_progress', 'done', 'declined', 'duplicate',
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = Number(params.id);
  if (!Number.isFinite(postId) || postId <= 0) {
    return NextResponse.json({ error: 'invalid post id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const patch = parsePatch(body);
  if ('error' in patch) {
    return NextResponse.json({ error: patch.error }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty patch' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('feedback_posts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select('id, status, is_hidden, duplicate_of')
    .maybeSingle();

  if (error) {
    console.error('[api/admin/feedback PATCH]', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'post not found' }, { status: 404 });
  }

  revalidatePath('/feedback');
  revalidatePath('/admin/feedback');
  return NextResponse.json({ post: data });
}

function parsePatch(
  body: unknown
):
  | { status?: FeedbackStatus; is_hidden?: boolean; duplicate_of?: number | null }
  | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid body' };
  const b = body as Record<string, unknown>;
  const patch: {
    status?: FeedbackStatus;
    is_hidden?: boolean;
    duplicate_of?: number | null;
  } = {};

  if ('status' in b) {
    if (!VALID_STATUSES.includes(b.status as FeedbackStatus)) {
      return { error: 'invalid status' };
    }
    patch.status = b.status as FeedbackStatus;
  }
  if ('is_hidden' in b) {
    if (typeof b.is_hidden !== 'boolean') return { error: 'invalid is_hidden' };
    patch.is_hidden = b.is_hidden;
  }
  if ('duplicate_of' in b) {
    if (b.duplicate_of === null) {
      patch.duplicate_of = null;
    } else {
      const n = Number(b.duplicate_of);
      if (!Number.isFinite(n) || n <= 0) return { error: 'invalid duplicate_of' };
      patch.duplicate_of = n;
    }
  }
  return patch;
}
