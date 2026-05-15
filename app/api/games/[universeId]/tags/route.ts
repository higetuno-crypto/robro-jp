import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createBrowserClient, createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import {
  fetchGameTags,
  countRecentVotes,
  castVote,
  makeFingerprint,
} from '@/lib/tags';
import { maybeAwardFirstTagger } from '@/lib/badges';

/**
 * フェーズ6：タグAPI
 *
 * GET  /api/games/[universeId]/tags  → 公式タグ全件 + ユーザータグTOP5
 * POST /api/games/[universeId]/tags  → { tag_id } で1票投じる（選択式のみ）
 *
 * レートリミット（拡張ガイドライン#1 イベントログ型で算出）：
 *  - 同一 account_id × (universe, tag) = 24h内1票（cast_tag_vote RPC で原子的に判定）
 *  - 同一 account_id = 60秒あたり20票
 *  - 同一 account_id = 1日あたり50票
 *  fingerprint は引き続きログに残し、将来 BAN/解析時の補助シグナルとして保持。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TAGS_PER_REQUEST = 5;
const LIMIT_PER_MINUTE = 20;
const LIMIT_PER_DAY = 50;

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
    const supabase = createBrowserClient();
    const { official, community } = await fetchGameTags(supabase, universeId, {
      userTagLimit: 5,
    });
    return NextResponse.json(
      { universe_id: universeId, official, community },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (e) {
    console.error('[api/tags GET]', e);
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

  // ログイン必須（サイト閲覧はログイン不要だが、投票はログインユーザーのみ）
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

  // 本体：{ tag_ids: ['collab_good', ...] } または { tag_id: 'collab_good' }
  const tagIds = normalizeTagIds(body);
  if (!tagIds || tagIds.length === 0) {
    return NextResponse.json({ error: 'tag_id(s) required' }, { status: 400 });
  }
  if (tagIds.length > MAX_TAGS_PER_REQUEST) {
    return NextResponse.json(
      { error: `too many tags (max ${MAX_TAGS_PER_REQUEST})` },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const fingerprint = makeFingerprint(ip, ua);

  const supabase = createServiceClient();

  // 全体レート（60秒20票 / 1日50票）。ログイン必須なので accountId 起点で集計する
  const { last60s, last24h } = await countRecentVotes(supabase, {
    accountId,
    fingerprint,
  });
  if (last60s >= LIMIT_PER_MINUTE || last24h + tagIds.length > LIMIT_PER_DAY) {
    return NextResponse.json(
      { error: 'rate limit exceeded' },
      { status: 429 }
    );
  }

  // ゲーム存在チェック
  const { data: game, error: gErr } = await supabase
    .from('games')
    .select('universe_id')
    .eq('universe_id', universeId)
    .maybeSingle();
  if (gErr) {
    console.error('[api/tags POST] game check', gErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json({ error: 'game not found' }, { status: 404 });
  }

  // タグ存在チェック（選択式のみ）
  const { data: validTags, error: tErr } = await supabase
    .from('tag_master')
    .select('tag_id')
    .in('tag_id', tagIds)
    .eq('is_active', true);
  if (tErr) {
    console.error('[api/tags POST] tag check', tErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  const validSet = new Set((validTags ?? []).map((r) => r.tag_id as string));
  const unknown = tagIds.filter((t) => !validSet.has(t));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: 'unknown tag_id', unknown },
      { status: 400 }
    );
  }

  const results: Array<{
    tag_id: string;
    status: 'ok' | 'duplicate';
    vote_count?: number;
    confidence_score?: number;
  }> = [];

  for (const tagId of tagIds) {
    try {
      const { voteCount, confidenceScore, isDuplicate } = await castVote(supabase, {
        universeId,
        tagId,
        fingerprint,
        accountId,
      });
      if (isDuplicate) {
        results.push({ tag_id: tagId, status: 'duplicate' });
        continue;
      }
      results.push({
        tag_id: tagId,
        status: 'ok',
        vote_count: voteCount,
        confidence_score: confidenceScore,
      });
    } catch (e) {
      console.error('[api/tags POST] castVote', e);
      return NextResponse.json({ error: 'vote failed' }, { status: 500 });
    }
  }

  // 投票が1件でも反映された場合、該当ゲーム詳細ページのISRキャッシュを破棄。
  // これにより Modal 側の router.refresh() で最新タグが即時表示される。
  const hasChanged = results.some((r) => r.status === 'ok');
  if (hasChanged) {
    revalidatePath(`/game/${universeId}`);
  }

  // first_tagger バッジ判定（1リクエスト=1ゲームに対して1回）
  let firstTaggerAwarded = false;
  if (hasChanged) {
    try {
      firstTaggerAwarded = await maybeAwardFirstTagger(
        supabase,
        accountId,
        universeId
      );
    } catch (e) {
      console.error('[api/tags POST] maybeAwardFirstTagger', e);
    }
  }

  return NextResponse.json({
    universe_id: universeId,
    results,
    first_tagger_awarded: firstTaggerAwarded,
  });
}

function normalizeTagIds(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.tag_ids)) {
    const arr = b.tag_ids.filter((v): v is string => typeof v === 'string' && v.length > 0);
    return Array.from(new Set(arr));
  }
  if (typeof b.tag_id === 'string' && b.tag_id.length > 0) {
    return [b.tag_id];
  }
  return null;
}
