import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { getCreatorById } from '@/lib/creators';
import { fetchGameDetails } from '@/lib/roblox-api';
import { parseRobloxPlaceIdFromGameUrl } from '@/lib/roblox-game-url';
import {
  resolvePlaceIdToUniverseId,
  decideGameOwnership,
  denyMessageJa,
} from '@/lib/roblox-game-ownership';

/**
 * POST /api/creators/[id]/games
 *  自薦ゲームの追加。本人 + verified のみ可。
 *  body のいずれか1つ：
 *    { game_url: string }     ← Robloxのゲーム URL（推奨）
 *    { place_id: number }
 *    { universe_id: number }
 *  + { is_primary?: boolean }
 *
 *  なりすまし対策（厳密モード）：
 *   - creator.type='User' かつ creator.id === 自分の roblox_user_id → 許可
 *   - creator.type='Group' かつ group.owner.userId === 自分の roblox_user_id → 許可
 *   - それ以外 → 拒否（共同開発者・元メンバーは MVP 非対応）
 *
 * DELETE /api/creators/[id]/games?universe_id=...
 *  自薦解除。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorizeCreator(creatorId: number, userIdAuth: string) {
  const supabase = createServiceClient();
  const creator = await getCreatorById(supabase, creatorId);
  if (!creator) return { error: 'not_found', status: 404 as const };
  if (creator.account_id !== userIdAuth) return { error: 'forbidden', status: 403 as const };
  if (!creator.is_verified) return { error: 'creator_not_verified', status: 403 as const };
  if (!creator.roblox_user_id) return { error: 'creator_roblox_user_id_missing', status: 500 as const };
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
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const auth = await authorizeCreator(creatorId, user.id);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { creator, supabase } = auth;

  let body: { game_url?: unknown; place_id?: unknown; universe_id?: unknown; is_primary?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const is_primary = body.is_primary === true;

  // universeId を確定させる：universe_id 直指定 > game_url > place_id
  let universeId: number | null = null;

  if (typeof body.universe_id === 'number' && body.universe_id > 0) {
    universeId = body.universe_id;
  } else if (typeof body.universe_id === 'string' && /^\d+$/.test(body.universe_id)) {
    universeId = Number.parseInt(body.universe_id, 10);
  } else {
    let placeId: number | null = null;
    if (typeof body.game_url === 'string' && body.game_url.length > 0) {
      placeId = parseRobloxPlaceIdFromGameUrl(body.game_url);
      if (!placeId) {
        return NextResponse.json(
          {
            error: 'invalid_game_url',
            hint: 'https://www.roblox.com/games/<placeId>/... の形式で貼り付けてください',
          },
          { status: 400 }
        );
      }
    } else if (typeof body.place_id === 'number' && body.place_id > 0) {
      placeId = body.place_id;
    } else if (typeof body.place_id === 'string' && /^\d+$/.test(body.place_id)) {
      placeId = Number.parseInt(body.place_id, 10);
    }

    if (placeId) {
      universeId = await resolvePlaceIdToUniverseId(placeId);
      if (!universeId) {
        return NextResponse.json(
          { error: 'place_to_universe_failed', place_id: placeId },
          { status: 404 }
        );
      }
    }
  }

  if (!universeId) {
    return NextResponse.json(
      { error: 'missing_game_identifier', hint: 'game_url か place_id か universe_id のいずれかを指定してください' },
      { status: 400 }
    );
  }

  // games に既存があるか確認
  const { data: existingGame } = await supabase
    .from('games')
    .select('universe_id, name, creator_name, creator_type')
    .eq('universe_id', universeId)
    .maybeSingle();

  // creator情報を取得（既存・新規どちらでも Roblox から最新を取って厳密判定）
  // → games 行があっても creator_name しかなく id が分からないため、Roblox API は必ず叩く
  const fetched = await fetchGameDetails([universeId]);
  if (!fetched || fetched.length === 0) {
    return NextResponse.json(
      { error: 'roblox_game_not_found', universe_id: universeId },
      { status: 404 }
    );
  }
  const g = fetched[0];

  // オーナー判定
  const decision = await decideGameOwnership(
    g.creator
      ? { id: g.creator.id, name: g.creator.name, type: g.creator.type }
      : null,
    creator.roblox_user_id!
  );
  if (decision.kind === 'deny') {
    return NextResponse.json(
      {
        error: 'ownership_check_failed',
        reason: decision.reason,
        message: denyMessageJa(decision),
        creator_name: decision.creatorName,
      },
      { status: 403 }
    );
  }

  // games が無ければ INSERT
  if (!existingGame) {
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
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  }

  // is_primary=TRUE の場合、同 creator の他行を FALSE に
  if (is_primary) {
    const { error: demoteErr } = await supabase
      .from('creator_games')
      .update({ is_primary: false })
      .eq('creator_id', creatorId)
      .neq('universe_id', universeId);
    if (demoteErr) {
      console.error('[creator games demote]', demoteErr);
    }
  }

  const { error: upsertErr } = await supabase
    .from('creator_games')
    .upsert(
      { creator_id: creatorId, universe_id: universeId, is_primary },
      { onConflict: 'creator_id,universe_id' }
    );
  if (upsertErr) {
    console.error('[creator games upsert]', upsertErr);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  revalidatePath(`/creators/${creatorId}`);
  revalidatePath('/creators/me');
  return NextResponse.json({
    ok: true,
    universe_id: universeId,
    is_primary,
    ownership: decision.reason,
    game_name: g.name,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });

  const creatorId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const auth = await authorizeCreator(creatorId, user.id);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  const url = new URL(req.url);
  const universe_id = Number.parseInt(url.searchParams.get('universe_id') ?? '', 10);
  if (!Number.isFinite(universe_id) || universe_id <= 0) {
    return NextResponse.json({ error: 'invalid_universe_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('creator_games')
    .delete()
    .eq('creator_id', creatorId)
    .eq('universe_id', universe_id);
  if (error) {
    console.error('[creator games DELETE]', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath('/creators/me');
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/creators/[id]/games?universe_id=...
 *  body: { is_primary: boolean }
 *  既存の自薦の is_primary だけを切り替える。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });

  const creatorId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const auth = await authorizeCreator(creatorId, user.id);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  const url = new URL(req.url);
  const universe_id = Number.parseInt(url.searchParams.get('universe_id') ?? '', 10);
  if (!Number.isFinite(universe_id) || universe_id <= 0) {
    return NextResponse.json({ error: 'invalid_universe_id' }, { status: 400 });
  }

  let body: { is_primary?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const is_primary = body.is_primary === true;

  if (is_primary) {
    const { error: demoteErr } = await supabase
      .from('creator_games')
      .update({ is_primary: false })
      .eq('creator_id', creatorId)
      .neq('universe_id', universe_id);
    if (demoteErr) {
      console.error('[creator games PATCH demote]', demoteErr);
    }
  }

  const { error } = await supabase
    .from('creator_games')
    .update({ is_primary })
    .eq('creator_id', creatorId)
    .eq('universe_id', universe_id);
  if (error) {
    console.error('[creator games PATCH]', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  revalidatePath(`/creators/${creatorId}`);
  revalidatePath('/creators/me');
  return NextResponse.json({ ok: true });
}
