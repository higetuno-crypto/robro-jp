import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * 発信者情報開示ログ（tip_disclosure_logs）の自動削除。
 *
 * 仕様：生IPは3ヶ月のみ短期保管（higesakusei/新しい方向性/攻略Tips-MVP設計.md §11-3）。
 * Vercel Cron（または外部スケジューラ）から日次で叩く。
 *   vercel.json:
 *     { "path": "/api/cron/purge-disclosure-logs", "schedule": "0 18 * * *" }
 *
 * 認証：Authorization: Bearer <CRON_SECRET>
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RETENTION_DAYS = 90;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('tip_disclosure_logs')
      .delete()
      .lt('created_at', cutoff)
      .select('id');
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      deleted: data?.length ?? 0,
      cutoff,
      retention_days: RETENTION_DAYS,
    });
  } catch (e) {
    console.error('[cron/purge-disclosure-logs]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
