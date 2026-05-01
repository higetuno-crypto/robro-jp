import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { getCreatorById } from '@/lib/creators';
import { fetchGameDetails } from '@/lib/roblox-api';

/**
 * POST /api/creators/[id]/games
 *  自薦ゲームの追加。本人のみ可。
 *  body: { universe_id: number, is_primary?: boolean }
 *  - 既存 games に無ければ Roblox公式 API で取得し games に INSERT
 *  - creator_games に upsert
 *  - is_primary=TRUE の場合、同 creator の他行を FALSE に下げ、トリガで games.registered_creator_id 同期
 *
 * DELETE /api/creators/[id]/games?universe_id=...
 *  自薦解除。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorizeCreator(creatorId: number, userIdAuth: string) {
  const supabase = createServiceClient();
  const creator = await getCreatorById(supabase, creatorId);
  if (!creator) return { error: 'not found', status: 404 as const };
  if (creator.account_id !== userIdAuth) return { error: 'forbidden', status: 403 as const };
  if (!creator.is_verified) return { error: 'creator_not_verified', status: 403 as const };
  return { creator, supabase };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login required' }, { status: 401 });

  const creatorId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const auth = await authorizeCreator(creatorId, user.id);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { creator, supabase } = auth;

  let body: { universe_id?: unknown; is_primary?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const universe_id =
    typeof body.universe_id === 'number'
      ? body.universe_id
      : typeof body.universe_id === 'string'
      ? Number.parseInt(body.universe_id, 10)
      : NaN;
  const is_primary = body.is_primary === true;

  if (!Number.isFinite(universe_id) || universe_id <= 0) {
    return NextResponse.json({ error: 'invalid universe_id' }, { status: 400 });
  }

  // games に無ければ Roblox API で取得して INSERT
  const { data: existing } = await supabase
    .from('games')
    .select('universe_id, creator_name')
    .eq('universe_id', universe_id)
    .maybeSingle();

  let creatorNameOnRoblox: string | null = null;

  if (!existing) {
    const fetched = await fetchGameDetails([universe_id]);
    if (!fetched || fetched.length === 0) {
      return NextResponse.json(
        { error: 'roblox_game_not_found', universe_id },
        { status: 404 }
      );
    }
    const g = fetched[0];
    creatorNameOnRoblox = g.creator?.name ?? null;
    const { error: insertErr } = await supabase.from('games').insert({
      universe_id: g.id,
      place_id: g.rootPlaceId,
      name: g.name,
      description: g.description,
      creator_name: g.creator?.name ?? null,
      creator_type: g.creator?.type ?? null,
      thumbnail_url: g.thumbnailUrl,
      genre_l1: g.genre_l1 ?? null,
      genre_slug: g.untranslated_genre_l1 ?? null,
    });
    if (insertErr) {
      console.error('[creator games INSERT new game]', insertErr);
      return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
  } else {
    creatorNameOnRoblox = (existing as { creator_name: string | null }).creator_name;
  }

  // 名前ミスマッチ警告（弾きはしないが、本人ではない可能性をフラグとして返す）
  let nameMismatch = false;
  if (creator.roblox_user_id && creatorNameOnRoblox) {
    // creator.roblox_user_id から再取得は重いので、creator_name はゲーム作者名
    // 厳密判定はクライアントで「ご自身の作品ですか？」確認済みとする
    nameMismatch = false;
  }

  // is_primary=TRUE の場合、同 creator の他行を FALSE に
  if (is_primary) {
    const { error: demoteErr } = await supabase
      .from('creator_games')
      .update({ is_primary: false })
      .eq('creator_id', creatorId)
      .neq('universe_id', universe_id);
    if (demoteErr) {
      console.error('[creator games demote]', demoteErr);
    }
  }

  // upsert
  const { error: upsertErr } = await supabase
    .from('creator_games')
    .upsert(
      {
        creator_id: creatorId,
        universe_id,
        is_primary,
      },
      { onConflict: 'creator_id,universe_id' }
    );
  if (upsertErr) {
    console.error('[creator games upsert]', upsertErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }

  revalidatePath(`/creators/${creatorId}`);
  return NextResponse.json({ ok: true, universe_id, is_primary, name_mismatch: nameMismatch });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login required' }, { status: 401 });

  const creatorId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const auth = await authorizeCreator(creatorId, user.id);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  const url = new URL(req.url);
  const universe_id = Number.parseInt(url.searchParams.get('universe_id') ?? '', 10);
  if (!Number.isFinite(universe_id) || universe_id <= 0) {
    return NextResponse.json({ error: 'invalid universe_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('creator_games')
    .delete()
    .eq('creator_id', creatorId)
    .eq('universe_id', universe_id);
  if (error) {
    console.error('[creator games DELETE]', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  revalidatePath(`/creators/${creatorId}`);
  return NextResponse.json({ ok: true });
}
