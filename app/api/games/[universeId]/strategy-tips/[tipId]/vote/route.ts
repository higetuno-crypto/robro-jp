import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { makeFingerprint } from '@/lib/tags';
import { voteTip, countRecentTipVotes } from '@/lib/strategy-tips';

/**
 * POST /api/games/[universeId]/strategy-tips/[tipId]/vote
 * 攻略Tipsへの👍投票（匿名可・1 fingerprint × 1 tip = 1票）。
 * 投票スパム抑止：60秒30票/ fingerprint。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VOTE_PER_MIN = 30;

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ universeId: string; tipId: string }> }
) {
  const { universeId: uRaw, tipId: tRaw } = await props.params;
  const universeId = Number(uRaw);
  const tipId = Number(tRaw);
  if (!Number.isFinite(tipId) || tipId <= 0) {
    return NextResponse.json({ error: 'invalid tipId' }, { status: 400 });
  }

  const user = await getCurrentUser();
  const accountId = user?.id ?? null;

  const ipRaw =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = makeFingerprint(ipRaw || 'unknown', ua);

  const supabase = createServiceClient();

  try {
    const recent = await countRecentTipVotes(supabase, fingerprint);
    if (recent >= VOTE_PER_MIN) {
      return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
    }

    const { helpfulCount, isDuplicate } = await voteTip(supabase, {
      tipId,
      accountId,
      fingerprint,
    });
    if (!isDuplicate && Number.isFinite(universeId)) {
      revalidatePath(`/game/${universeId}`);
    }
    return NextResponse.json({ helpful_count: helpfulCount, duplicate: isDuplicate });
  } catch (e) {
    console.error('[api/strategy-tips vote]', e);
    return NextResponse.json({ error: 'vote_failed' }, { status: 400 });
  }
}
