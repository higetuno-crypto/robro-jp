import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { validateStreamMeta, collectMetaTexts } from '@/lib/streaming';
import { moderateFields, hasBlockingIssue } from '@/lib/moderation';

/**
 * 管理API：game_streaming_meta の upsert / delete
 *
 * middleware で /api/admin/* は Basic 認証済み。
 *
 *  PUT    /api/admin/stream-meta/[universeId] ... 入力検証 + モデレーション + upsert
 *  DELETE /api/admin/stream-meta/[universeId] ... 行削除
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseUniverseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PUT(req: NextRequest, props: { params: Promise<{ universeId: string }> }) {
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

  const validated = validateStreamMeta(body);
  if (!validated.ok || !validated.value) {
    return NextResponse.json(
      { error: 'validation failed', issues: validated.issues },
      { status: 400 }
    );
  }

  // 文言モデレーション（block のみ拒否、warn は通す）
  const texts = collectMetaTexts(validated.value);
  const modIssues = moderateFields(texts);
  const blocking = modIssues.filter((f) => hasBlockingIssue(f.issues));
  if (blocking.length > 0) {
    return NextResponse.json(
      { error: 'moderation blocked', issues: blocking },
      { status: 422 }
    );
  }

  const supabase = createServiceClient();

  const { data: game, error: gErr } = await supabase
    .from('games')
    .select('universe_id')
    .eq('universe_id', universeId)
    .maybeSingle();
  if (gErr) {
    console.error('[admin/stream-meta PUT] game check', gErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json({ error: 'game not found' }, { status: 404 });
  }

  const v = validated.value;
  const { error } = await supabase.from('game_streaming_meta').upsert(
    {
      universe_id: universeId,
      short_pitch_ja: v.short_pitch_ja,
      stream_summary_ja: v.stream_summary_ja,
      stream_points: v.stream_points,
      solo_fit: v.solo_fit,
      collab_fit: v.collab_fit,
      viewer_participation_fit: v.viewer_participation_fit,
      clip_fit: v.clip_fit,
      english_barrier: v.english_barrier,
      learning_curve: v.learning_curve,
      first_10min_guide: v.first_10min_guide,
      why_now_popular: v.why_now_popular,
      stream_caution_notes: v.stream_caution_notes,
      recommended_party_size: v.recommended_party_size,
      average_session_length: v.average_session_length,
      share_card_enabled: v.share_card_enabled,
      editorial_score_stream: v.editorial_score_stream,
    },
    { onConflict: 'universe_id' }
  );
  if (error) {
    console.error('[admin/stream-meta PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 公開ページと /stream/[slot] のキャッシュを破棄
  revalidatePath(`/game/${universeId}`);
  revalidatePath('/stream');
  revalidatePath('/stream/collab');
  revalidatePath('/stream/viewer');
  revalidatePath('/stream/short');
  revalidatePath('/stream/reaction');
  revalidatePath('/stream/no-english');
  revalidatePath('/stream/loud');

  return NextResponse.json({ ok: true, warnings: modIssues });
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ universeId: string }> }) {
  const params = await props.params;
  const universeId = parseUniverseId(params.universeId);
  if (universeId === null) {
    return NextResponse.json({ error: 'invalid universeId' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('game_streaming_meta')
    .delete()
    .eq('universe_id', universeId);
  if (error) {
    console.error('[admin/stream-meta DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath(`/game/${universeId}`);
  return NextResponse.json({ ok: true });
}
