import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TARGETS = ['game', 'creator', 'tag'] as const;
type TargetType = (typeof VALID_TARGETS)[number];

const LIMIT_PER_HOUR = 5;
const LIMIT_PER_DAY = 20;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const target_type = typeof body.target_type === 'string' ? body.target_type : '';
  const target_id =
    typeof body.target_id === 'number'
      ? body.target_id
      : typeof body.target_id === 'string'
      ? Number.parseInt(body.target_id, 10)
      : NaN;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!VALID_TARGETS.includes(target_type as TargetType)) {
    return NextResponse.json({ error: 'invalid_target_type' }, { status: 400 });
  }
  if (!Number.isFinite(target_id) || target_id <= 0) {
    return NextResponse.json({ error: 'invalid_target_id' }, { status: 400 });
  }
  if (reason.length < 5 || reason.length > 500) {
    return NextResponse.json({ error: 'reason_must_be_5_to_500_chars' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // レートリミット
  const since1h = new Date(Date.now() - 3600_000).toISOString();
  const since24h = new Date(Date.now() - 86400_000).toISOString();
  const { count: c1h } = await supabase
    .from('moderation_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_account_id', user.id)
    .gte('created_at', since1h);
  const { count: c24h } = await supabase
    .from('moderation_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_account_id', user.id)
    .gte('created_at', since24h);
  if ((c1h ?? 0) >= LIMIT_PER_HOUR || (c24h ?? 0) >= LIMIT_PER_DAY) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  // 同一ターゲットへの重複通報は1日1回まで（自分の通報）
  const { data: dup } = await supabase
    .from('moderation_reports')
    .select('id')
    .eq('reporter_account_id', user.id)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .gte('created_at', since24h)
    .maybeSingle();
  if (dup) {
    return NextResponse.json({ error: 'duplicate_report_within_24h' }, { status: 409 });
  }

  const { error } = await supabase.from('moderation_reports').insert({
    reporter_account_id: user.id,
    target_type,
    target_id,
    reason,
  });
  if (error) {
    console.error('[moderation reports POST]', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
