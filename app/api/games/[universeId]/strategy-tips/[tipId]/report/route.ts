import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { makeFingerprint } from '@/lib/tags';
import { reportTip, countRecentTipReports, isValidReportReason } from '@/lib/strategy-tips';

/**
 * POST /api/games/[universeId]/strategy-tips/[tipId]/report
 * 攻略Tipsの通報（匿名可）。閾値到達で自動 hidden に退避（事後モデレーション）。
 * 通報スパム抑止：24時間20件/ fingerprint。
 * public へは件数を返さない（gaming 防止）。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPORT_PER_DAY = 20;
const DETAIL_MAX = 500;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const reason = b.reason;
  if (!isValidReportReason(reason)) {
    return NextResponse.json({ error: 'invalid reason' }, { status: 400 });
  }
  let detail: string | null = typeof b.detail === 'string' ? b.detail.trim() : null;
  if (detail && detail.length > DETAIL_MAX) {
    return NextResponse.json({ error: 'detail too long' }, { status: 400 });
  }
  if (detail === '') detail = null;

  const ipRaw =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = makeFingerprint(ipRaw || 'unknown', ua);

  const supabase = createServiceClient();

  try {
    const recent = await countRecentTipReports(supabase, fingerprint);
    if (recent >= REPORT_PER_DAY) {
      return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
    }

    const { autoHidden } = await reportTip(supabase, { tipId, reason, detail, fingerprint });
    if (autoHidden && Number.isFinite(universeId)) {
      revalidatePath(`/game/${universeId}`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/strategy-tips report]', e);
    return NextResponse.json({ error: 'report_failed' }, { status: 400 });
  }
}
