import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { calcConfidence } from '@/lib/tags';

/**
 * ADMIN：特定ゲームに付いたタグの管理。
 *
 * middleware.ts で /api/admin/* は Basic 認証済み。
 *
 * PATCH  : { tag_id, delta }  delta= -N/+N で vote_count を増減
 * DELETE : ?tag_id=xxx        game_tag_votes の行を削除（ログは残す）
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseUniverseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ universeId: string }> }) {
  const params = await props.params;
  const universeId = parseUniverseId(params.universeId);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const tagId = typeof b.tag_id === 'string' ? b.tag_id : null;
  const delta = typeof b.delta === 'number' ? Math.trunc(b.delta) : null;
  if (!tagId || delta === null || delta === 0) {
    return NextResponse.json(
      { error: 'tag_id と非ゼロの delta が必要' },
      { status: 400 }
    );
  }
  if (Math.abs(delta) > 100) {
    return NextResponse.json({ error: 'delta が大きすぎる' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existing, error: selErr } = await supabase
    .from('game_tag_votes')
    .select('vote_count')
    .eq('universe_id', universeId)
    .eq('tag_id', tagId)
    .maybeSingle();
  if (selErr) {
    console.error('[admin games tags PATCH] select', selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json(
      { error: '対象の投票行が存在しません' },
      { status: 404 }
    );
  }
  const next = Math.max(0, (existing.vote_count as number) + delta);

  if (next === 0) {
    const { error: delErr } = await supabase
      .from('game_tag_votes')
      .delete()
      .eq('universe_id', universeId)
      .eq('tag_id', tagId);
    if (delErr) {
      console.error('[admin games tags PATCH] delete-on-zero', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    revalidatePath(`/game/${universeId}`);
    return NextResponse.json({
      ok: true,
      tag_id: tagId,
      vote_count: 0,
      removed: true,
    });
  }

  const { error: upErr } = await supabase
    .from('game_tag_votes')
    .update({
      vote_count: next,
      confidence_score: calcConfidence(next),
      last_voted_at: new Date().toISOString(),
    })
    .eq('universe_id', universeId)
    .eq('tag_id', tagId);
  if (upErr) {
    console.error('[admin games tags PATCH] update', upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  revalidatePath(`/game/${universeId}`);
  return NextResponse.json({
    ok: true,
    tag_id: tagId,
    vote_count: next,
  });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ universeId: string }> }) {
  const params = await props.params;
  const universeId = parseUniverseId(params.universeId);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }
  const url = new URL(req.url);
  const tagId = url.searchParams.get('tag_id');
  if (!tagId) {
    return NextResponse.json({ error: 'tag_id required' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('game_tag_votes')
    .delete()
    .eq('universe_id', universeId)
    .eq('tag_id', tagId);
  if (error) {
    console.error('[admin games tags DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath(`/game/${universeId}`);
  return NextResponse.json({ ok: true, tag_id: tagId, removed: true });
}
