import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-ssr';
import { verifyRobloxDescriptionContainsCode } from '@/lib/roblox-creator-verify';
import { getCreatorById, isVerificationCodeExpired } from '@/lib/creators';

/**
 * POST /api/creators/[id]/verify
 *  Robloxプロフィール description に確認コードが入っているかを照合し、
 *  成功すれば is_verified=TRUE / verification_code=NULL に更新。
 *
 *  description 本文は読み取り後に破棄（永続化禁止）。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const creator = await getCreatorById(supabase, id, { includeVerification: true });
  if (!creator) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (creator.account_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (creator.is_verified) {
    return NextResponse.json({ ok: true, already_verified: true });
  }

  if (!creator.verification_code || !creator.roblox_user_id) {
    return NextResponse.json({ error: 'verification_not_initialized' }, { status: 400 });
  }
  if (isVerificationCodeExpired(creator)) {
    return NextResponse.json({ error: 'verification_code_expired' }, { status: 410 });
  }

  const matched = await verifyRobloxDescriptionContainsCode(
    creator.roblox_user_id,
    creator.verification_code
  );
  if (!matched) {
    return NextResponse.json(
      { error: 'code_not_found_in_description', hint: 'プロフィールのbio保存反映に時間がかかる場合があります。1〜2分待って再試行してください' },
      { status: 422 }
    );
  }

  const { error } = await supabase
    .from('creators')
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verification_code: null,
      verification_expires_at: null,
    })
    .eq('id', id);
  if (error) {
    // 部分UNIQUE（uq_creators_verified_roblox_user）に引っ掛かった場合 = 同一RobloxユーザーIDの2重verified
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'roblox_user_id_already_verified_by_other_account' },
        { status: 409 }
      );
    }
    console.error('[creators verify update]', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }

  revalidatePath(`/creators/${id}`);
  revalidatePath('/creators');
  return NextResponse.json({ ok: true });
}
