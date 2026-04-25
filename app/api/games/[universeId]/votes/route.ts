import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase-ssr';
import {
  fetchGameButtonVotes,
  fetchUserVoteState,
  countRecentVotesByAccount,
  hasActiveVote,
  castButtonVote,
  makeFingerprint,
  VOTE_LIMIT_PER_MINUTE,
  VOTE_LIMIT_PER_DAY,
} from '@/lib/votes';
import type { ButtonType } from '@/lib/ranking-vote';

/**
 * フェーズ8：3ボタン投票 API
 *
 * GET  /api/games/[universeId]/votes
 *   → 集計カウント + ログイン中ならユーザー本人の投票状態
 *
 * POST /api/games/[universeId]/votes
 *   Body: { button_type: 'like'|'save'|'recommend', action: 'add'|'remove' }
 *   → ログイン必須・レートリミット適用・投票記録
 *
 * 上位文書：feature-spec.md §3.4, idea-evaluation-v3.md §A1-A4
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_BUTTONS: ButtonType[] = ['like', 'save', 'recommend'];

function parseUniverseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { universeId: string } }
) {
  const universeId = parseUniverseId(params.universeId);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }
  try {
    const anon = createBrowserClient();
    const counts = await fetchGameButtonVotes(anon, universeId);

    let userState = { like: false, save: false, recommend: false };
    const user = await getCurrentUser();
    if (user) {
      const ssr = createSupabaseServerClient();
      userState = await fetchUserVoteState(ssr, universeId, user.id);
    }

    return NextResponse.json(
      {
        universe_id: universeId,
        like: { count: counts.like, user_voted: userState.like },
        save: { count: counts.save, user_voted: userState.save },
        recommend: { count: counts.recommend, user_voted: userState.recommend },
      },
      // 集計値はキャッシュOK、ユーザー固有は短く
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    console.error('[api/votes GET]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { universeId: string } }
) {
  const universeId = parseUniverseId(params.universeId);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }

  // ログイン必須
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }
  const accountId = user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const buttonType = (body as { button_type?: unknown }).button_type;
  const action = (body as { action?: unknown }).action;

  if (typeof buttonType !== 'string' || !ALLOWED_BUTTONS.includes(buttonType as ButtonType)) {
    return NextResponse.json({ error: 'invalid button_type' }, { status: 400 });
  }
  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // 既存状態と矛盾しない操作か確認
  const active = await hasActiveVote(supabase, universeId, buttonType as ButtonType, accountId);
  if (action === 'add' && active) {
    return NextResponse.json({ error: 'already voted within 24h' }, { status: 409 });
  }
  if (action === 'remove' && !active) {
    return NextResponse.json({ error: 'no active vote to remove' }, { status: 409 });
  }

  // レートリミット
  const { last60s, last24h } = await countRecentVotesByAccount(supabase, accountId);
  if (last60s >= VOTE_LIMIT_PER_MINUTE) {
    return NextResponse.json(
      { error: 'rate limit: too many votes per minute' },
      { status: 429 }
    );
  }
  if (last24h >= VOTE_LIMIT_PER_DAY) {
    return NextResponse.json(
      { error: 'rate limit: daily vote limit reached' },
      { status: 429 }
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0';
  const userAgent = req.headers.get('user-agent') ?? '';
  const fingerprint = makeFingerprint(ip, userAgent);

  try {
    const { voteCount } = await castButtonVote(supabase, {
      universeId,
      buttonType: buttonType as ButtonType,
      accountId,
      fingerprint,
      voteValue: action === 'add' ? 1 : -1,
    });
    return NextResponse.json({
      universe_id: universeId,
      button_type: buttonType,
      vote_count: voteCount,
      user_voted: action === 'add',
    });
  } catch (e) {
    console.error('[api/votes POST]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
