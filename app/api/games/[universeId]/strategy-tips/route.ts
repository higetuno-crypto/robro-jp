import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isIP } from 'net';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { makeFingerprint } from '@/lib/tags';
import { moderateUserTip, hasBlockingIssue } from '@/lib/moderation';
import {
  fetchTips,
  countRecentTips,
  postTip,
  isValidTipCategory,
  TIP_BODY_MIN,
  TIP_BODY_MAX,
  type StrategyTipCategory,
} from '@/lib/strategy-tips';

/**
 * 攻略Tips API
 *
 * GET  /api/games/[universeId]/strategy-tips        → 公開Tips一覧（👍降順）
 * POST /api/games/[universeId]/strategy-tips        → 投稿（匿名可）
 *
 * 投稿レートリミット（匿名は厳しめ）：
 *  - 匿名（fingerprint）：60秒2件 / 1日10件
 *  - ログイン（account_id）：60秒3件 / 1日20件
 * 禁止語は moderateUserTip でブロック。生IPは RPC 内で tip_disclosure_logs に分離保管。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 機能フラグ：法令対応・種まきが整うまで投稿(UGC+IP収集)を受け付けない（拡張ガイドライン#6）
const STRATEGY_TIPS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_STRATEGY_TIPS === 'true';

const ANON_PER_MIN = 2;
const ANON_PER_DAY = 10;
const USER_PER_MIN = 3;
const USER_PER_DAY = 20;

function parseUniverseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    ''
  );
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ universeId: string }> }
) {
  const { universeId: raw } = await props.params;
  const universeId = parseUniverseId(raw);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }
  const categoryRaw = new URL(req.url).searchParams.get('category');
  const category: StrategyTipCategory | 'all' = isValidTipCategory(categoryRaw)
    ? categoryRaw
    : 'all';

  try {
    const tips = await fetchTips(universeId, { category });
    return NextResponse.json(
      { universe_id: universeId, tips },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    );
  } catch (e) {
    console.error('[api/strategy-tips GET]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ universeId: string }> }
) {
  // 機能フラグOFFのあいだは投稿経路を閉じる（UGC+IP収集を起動しない）
  if (!STRATEGY_TIPS_ENABLED) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { universeId: raw } = await props.params;
  const universeId = parseUniverseId(raw);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }

  // 匿名OK：ログインしていれば account_id を付与、未ログインでも続行
  const user = await getCurrentUser();
  const accountId = user?.id ?? null;

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

  // 禁止語（人格攻撃・差別・脅迫）。affiliation 語は攻略文では許容
  const issues = moderateUserTip(parsed.body);
  if (hasBlockingIssue(issues)) {
    return NextResponse.json({ error: 'moderation_block', issues }, { status: 422 });
  }

  const ipRaw = extractIp(req);
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = makeFingerprint(ipRaw || 'unknown', ua);
  const ipForLog = isIP(ipRaw) ? ipRaw : null; // 開示ログ用：有効IPのみ、無効はNULL

  const supabase = createServiceClient();

  // レートリミット
  const { last60s, last24h } = await countRecentTips(supabase, { accountId, fingerprint });
  const perMin = accountId ? USER_PER_MIN : ANON_PER_MIN;
  const perDay = accountId ? USER_PER_DAY : ANON_PER_DAY;
  if (last60s >= perMin || last24h >= perDay) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  // ゲーム存在チェック
  const { data: game, error: gErr } = await supabase
    .from('games')
    .select('universe_id')
    .eq('universe_id', universeId)
    .maybeSingle();
  if (gErr) {
    console.error('[api/strategy-tips POST] game check', gErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json({ error: 'game not found' }, { status: 404 });
  }

  try {
    const tip = await postTip(supabase, {
      universeId,
      category: parsed.category,
      body: parsed.body,
      accountId,
      fingerprint,
      ip: ipForLog,
      userAgent: ua,
    });
    revalidatePath(`/game/${universeId}`);
    return NextResponse.json({ tip });
  } catch (e) {
    console.error('[api/strategy-tips POST] postTip', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

function parsePostBody(
  body: unknown
): { category: StrategyTipCategory; body: string } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid body' };
  const b = body as Record<string, unknown>;
  const category = typeof b.category === 'string' ? b.category : '';
  const text = typeof b.body === 'string' ? b.body.trim() : '';
  if (!isValidTipCategory(category)) return { error: 'invalid category' };
  if (text.length < TIP_BODY_MIN || text.length > TIP_BODY_MAX) {
    return { error: `body must be ${TIP_BODY_MIN}-${TIP_BODY_MAX} chars` };
  }
  return { category, body: text };
}
