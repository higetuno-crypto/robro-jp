import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { makeFingerprint } from '@/lib/tags';
import { toggleVote } from '@/lib/feedback';

/**
 * POST /api/feedback/[id]/vote → 投票トグル（ログイン必須、1アカウント=1票）
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const postId = Number(params.id);
  if (!Number.isFinite(postId) || postId <= 0) {
    return NextResponse.json({ error: 'invalid post id' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = makeFingerprint(ip, ua);

  const supabase = createServiceClient();

  // 投稿の存在と非表示フラグをチェック
  const { data: post, error: pErr } = await supabase
    .from('feedback_posts')
    .select('id, is_hidden')
    .eq('id', postId)
    .maybeSingle();
  if (pErr) {
    console.error('[api/feedback/vote] post check', pErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  if (!post || post.is_hidden) {
    return NextResponse.json({ error: 'post not found' }, { status: 404 });
  }

  try {
    const result = await toggleVote(supabase, {
      postId,
      accountId: user.id,
      fingerprint,
    });
    revalidatePath('/feedback');
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api/feedback/vote]', e);
    return NextResponse.json({ error: 'vote failed' }, { status: 500 });
  }
}
