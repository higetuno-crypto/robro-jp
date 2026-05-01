import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import {
  parseRobloxUserIdFromProfileUrl,
  fetchRobloxUserBasic,
  generateVerificationCode,
} from '@/lib/roblox-creator-verify';
import {
  CREATOR_DISPLAY_NAME_MAX,
  CREATOR_DISPLAY_NAME_MIN,
  CREATOR_INTRO_MAX,
  expirationFromNow,
  getCreatorByAccountId,
  validateSocialLinks,
} from '@/lib/creators';
import { moderateText, hasBlockingIssue } from '@/lib/moderation';

/**
 * フェーズ10：クリエイター自薦登録
 *
 * POST /api/creators
 *  本人ログイン必須。display_name / self_introduction / roblox_profile_url を受け取り、
 *  Roblox公式 users API で userId 実在確認後、verification_code を発行して creators 行を upsert。
 *  description 本文は保存しない（Third-Party App Policy 順守）。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegisterBody {
  display_name?: unknown;
  self_introduction?: unknown;
  avatar_url?: unknown;
  roblox_profile_url?: unknown;
  social_links?: unknown;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const display_name =
    typeof body.display_name === 'string' ? body.display_name.trim() : '';
  const self_introduction =
    typeof body.self_introduction === 'string' ? body.self_introduction.trim() : '';
  const avatar_url =
    typeof body.avatar_url === 'string' && body.avatar_url.trim().length > 0
      ? body.avatar_url.trim()
      : null;
  const roblox_profile_url =
    typeof body.roblox_profile_url === 'string' ? body.roblox_profile_url.trim() : '';

  if (
    display_name.length < CREATOR_DISPLAY_NAME_MIN ||
    display_name.length > CREATOR_DISPLAY_NAME_MAX
  ) {
    return NextResponse.json(
      { error: `display_name must be ${CREATOR_DISPLAY_NAME_MIN}-${CREATOR_DISPLAY_NAME_MAX} chars` },
      { status: 400 }
    );
  }
  if (self_introduction.length > CREATOR_INTRO_MAX) {
    return NextResponse.json(
      { error: `self_introduction must be ≤ ${CREATOR_INTRO_MAX} chars` },
      { status: 400 }
    );
  }

  // モデレーション（クソゲー等のブロック語）
  const introIssues = moderateText(self_introduction);
  if (hasBlockingIssue(introIssues)) {
    return NextResponse.json(
      { error: 'moderation_block', issues: introIssues },
      { status: 422 }
    );
  }

  const robloxUserId = parseRobloxUserIdFromProfileUrl(roblox_profile_url);
  if (!robloxUserId) {
    return NextResponse.json(
      { error: 'roblox_profile_url must be like https://www.roblox.com/users/<id>/profile' },
      { status: 400 }
    );
  }

  const social = validateSocialLinks(body.social_links ?? []);
  if ('error' in social) {
    return NextResponse.json({ error: social.error }, { status: 400 });
  }

  // avatar_url の URL バリデーション
  if (avatar_url) {
    try {
      const u = new URL(avatar_url);
      if (!['http:', 'https:'].includes(u.protocol)) {
        return NextResponse.json({ error: 'avatar_url must be http(s)' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'malformed avatar_url' }, { status: 400 });
    }
  }

  // Roblox実在確認
  const rb = await fetchRobloxUserBasic(robloxUserId);
  if (!rb) {
    return NextResponse.json(
      { error: 'roblox_user_not_found', roblox_user_id: robloxUserId },
      { status: 404 }
    );
  }

  const supabase = createServiceClient();

  // 既存creators行（同一account）に対しては UPDATE、なければ INSERT
  const existing = await getCreatorByAccountId(supabase, user.id);

  // 同一 Roblox user_id が既に他アカウントで verified なら拒否（uq_creators_verified_roblox_user で DB 制約あるが先に分かりやすいエラーで）
  if (!existing || existing.roblox_user_id !== robloxUserId) {
    const { data: clash } = await supabase
      .from('creators')
      .select('id, account_id, is_verified')
      .eq('roblox_user_id', robloxUserId)
      .eq('is_verified', true)
      .maybeSingle();
    if (clash && (clash as { account_id: string }).account_id !== user.id) {
      return NextResponse.json(
        { error: 'roblox_user_id_already_verified_by_other_account' },
        { status: 409 }
      );
    }
  }

  const verification_code = generateVerificationCode();
  const verification_expires_at = expirationFromNow();

  const payload = {
    account_id: user.id,
    display_name,
    self_introduction,
    avatar_url,
    social_links: social,
    roblox_profile_url,
    roblox_user_id: robloxUserId,
    verification_code,
    verification_expires_at,
    // is_verified は既存値を維持。再認証時は別エンドポイント
    ...(existing ? {} : { is_verified: false }),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from('creators')
      .update(payload)
      .eq('id', existing.id);
    if (error) {
      console.error('[creators POST update]', error);
      return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
    return NextResponse.json({
      creator_id: existing.id,
      verification_code,
      verification_expires_at,
      roblox_user_name: rb.name,
      next_step: 'put_code_in_roblox_description',
    });
  }

  const { data: created, error } = await supabase
    .from('creators')
    .insert(payload)
    .select('id')
    .single();
  if (error || !created) {
    console.error('[creators POST insert]', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }

  return NextResponse.json({
    creator_id: (created as { id: number }).id,
    verification_code,
    verification_expires_at,
    roblox_user_name: rb.name,
    next_step: 'put_code_in_roblox_description',
  });
}
