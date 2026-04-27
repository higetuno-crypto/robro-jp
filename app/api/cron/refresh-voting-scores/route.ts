import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * フェーズ8：マテビュー game_voting_scores の REFRESH
 *
 * Vercel Cron から10分ごとに叩かれる。
 *   vercel.json:
 *     { "path": "/api/cron/refresh-voting-scores", "schedule": "*\/10 * * * *" }
 *
 * 認証：Authorization: Bearer <CRON_SECRET>
 *
 * REFRESH MATERIALIZED VIEW CONCURRENTLY を SECURITY DEFINER 関数で実行。
 * UNIQUE INDEX があるため CONCURRENTLY 可、読み取りはブロックされない。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc('refresh_game_voting_scores');
    if (error) throw error;

    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      elapsed_ms: elapsedMs,
      refreshed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[cron/refresh-voting-scores]', e);
    return NextResponse.json(
      { error: 'internal error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}
