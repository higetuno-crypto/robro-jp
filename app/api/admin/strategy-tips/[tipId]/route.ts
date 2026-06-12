import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';

/**
 * PATCH /api/admin/strategy-tips/[tipId]
 *   body: { action: 'hide' | 'remove' | 'restore' | 'dismiss_reports' }
 *
 * 攻略Tips の事後モデレーション（通報キュー対応）。
 * Basic認証は middleware.ts で済み（/admin/* ・ /api/admin/*）。
 *
 * 各アクションは tip の status 変更 ＋ 監査ログ(game_strategy_tip_logs) ＋ open 通報の解決をまとめて行う：
 *  - hide   : status=hidden,    log 'hide',    open 通報 → actioned
 *  - remove : status=removed,   log 'remove',  open 通報 → actioned
 *  - restore: status=published, log 'restore', open 通報 → dismissed
 *  - dismiss_reports: status 変更なし、open 通報 → dismissed（通報が不当だった場合）
 *
 * NOTE: 単独運用・低同時実行のため複数 update は非トランザクション。
 *       原子性が必要になったら SECURITY DEFINER RPC 化する。
 *       dismiss_reports は tip を変更しないため game_strategy_tip_logs（tip ライフサイクル用）には
 *       記録しない。却下の証跡は game_strategy_tip_reports.status=dismissed に残る。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'hide' | 'remove' | 'restore' | 'dismiss_reports';
const ACTIONS: Action[] = ['hide', 'remove', 'restore', 'dismiss_reports'];

// 監査ログ上、手動モデレーションを示す fingerprint マーカー（自動退避の 'system:...' に倣う）
const ADMIN_FP = 'admin:manual';

const STATUS_BY_ACTION: Record<
  Exclude<Action, 'dismiss_reports'>,
  { status: 'hidden' | 'removed' | 'published'; event: 'hide' | 'remove' | 'restore' }
> = {
  hide: { status: 'hidden', event: 'hide' },
  remove: { status: 'removed', event: 'remove' },
  restore: { status: 'published', event: 'restore' },
};

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ tipId: string }> }
) {
  const { tipId: raw } = await props.params;
  // 整数のみ許可（1.5 や指数表記を弾き、PostgREST 側の 500 を避けて 400 に寄せる）
  if (!/^\d+$/.test(raw)) {
    return NextResponse.json({ error: 'invalid tip id' }, { status: 400 });
  }
  const tipId = Number(raw);
  if (!Number.isSafeInteger(tipId) || tipId <= 0) {
    return NextResponse.json({ error: 'invalid tip id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const action = (body as { action?: unknown })?.action;
  if (typeof action !== 'string' || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }
  const act = action as Action;

  const supabase = createServiceClient();

  // 対象 tip の存在確認（universe_id は revalidate に使う）
  const { data: tip, error: tErr } = await supabase
    .from('game_strategy_tips')
    .select('tip_id, universe_id, status')
    .eq('tip_id', tipId)
    .maybeSingle();
  if (tErr) {
    console.error('[api/admin/strategy-tips PATCH] fetch', tErr);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
  if (!tip) {
    return NextResponse.json({ error: 'tip not found' }, { status: 404 });
  }

  try {
    let newStatus: string = tip.status as string;

    if (act !== 'dismiss_reports') {
      const { status, event } = STATUS_BY_ACTION[act];
      newStatus = status;

      const { error: uErr } = await supabase
        .from('game_strategy_tips')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('tip_id', tipId);
      if (uErr) throw uErr;

      const { error: lErr } = await supabase
        .from('game_strategy_tip_logs')
        .insert({ tip_id: tipId, event, fingerprint: ADMIN_FP });
      if (lErr) throw lErr;
    }

    // open 通報の解決：復元/却下は dismissed、非表示/削除は actioned
    const resolution =
      act === 'restore' || act === 'dismiss_reports' ? 'dismissed' : 'actioned';
    const { error: rErr } = await supabase
      .from('game_strategy_tip_reports')
      .update({ status: resolution })
      .eq('tip_id', tipId)
      .eq('status', 'open');
    if (rErr) throw rErr;

    revalidatePath(`/game/${tip.universe_id}`);
    revalidatePath('/admin/strategy-tips');
    return NextResponse.json({ ok: true, tip_id: tipId, status: newStatus });
  } catch (e) {
    console.error('[api/admin/strategy-tips PATCH]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
