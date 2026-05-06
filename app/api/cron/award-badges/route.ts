import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { calcTagArtisanTier, EARLY_ACCESS_DEADLINE } from '@/lib/badges';

/**
 * フェーズ11：バッジ授与バッチ（日次想定）
 *
 * 担当バッジ：
 *  - tag_artisan : game_tag_vote_logs を account_id で集計、10票ごとに tier+1
 *  - early_access: accounts.created_at <= 2026-11-30 のアカウントへ付与
 *
 * first_tagger は投票時にリアルタイム判定するためここでは扱わない。
 *
 * 認証：CRON_SECRET（Bearer）
 *
 * 冪等：UPSERT で何度叩いても同じ結果になる。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();

  try {
    // ===== 1. tag_artisan =====
    // account_id ごとに投票数を数える
    const { data: voteLogs, error: vlErr } = await supabase
      .from('game_tag_vote_logs')
      .select('account_id')
      .not('account_id', 'is', null);
    if (vlErr) throw vlErr;

    const counts = new Map<string, number>();
    for (const r of voteLogs ?? []) {
      const id = r.account_id as string | null;
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    let artisanAwarded = 0;
    for (const [accountId, score] of Array.from(counts.entries())) {
      const tier = calcTagArtisanTier(score);
      if (tier < 1) continue;
      const { error } = await supabase.from('account_badges').upsert(
        {
          account_id: accountId,
          badge_key: 'tag_artisan',
          meta: { score, tier },
        },
        { onConflict: 'account_id,badge_key' }
      );
      if (error) {
        console.error('[award-badges] tag_artisan upsert error:', error);
        continue;
      }
      artisanAwarded++;
    }

    // ===== 2. early_access =====
    // accounts.created_at <= EARLY_ACCESS_DEADLINE のアカウントを引いて付与
    const { data: earlyAccounts, error: eaErr } = await supabase
      .from('accounts')
      .select('id, created_at')
      .lte('created_at', EARLY_ACCESS_DEADLINE);
    if (eaErr) throw eaErr;

    let earlyAwarded = 0;
    for (const a of earlyAccounts ?? []) {
      const { error } = await supabase.from('account_badges').upsert(
        {
          account_id: a.id,
          badge_key: 'early_access',
          meta: { signed_up_at: a.created_at },
        },
        { onConflict: 'account_id,badge_key' }
      );
      if (error) {
        console.error('[award-badges] early_access upsert error:', error);
        continue;
      }
      earlyAwarded++;
    }

    return NextResponse.json({
      ok: true,
      artisanAwarded,
      earlyAwarded,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[award-badges] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ローカル / 手動実行用
export async function GET(req: NextRequest) {
  return POST(req);
}
