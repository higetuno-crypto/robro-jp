import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * H2 短時間大量🔥検出（自動・cron）
 *
 * 検知ロジック：
 *   直近5分の game_button_vote_logs（button_type='recommend'）を fingerprint × universe_id で集計し、
 *   閾値以上を BAN 候補として moderation_ban_logs に reason_code='spam_vote' で記録。
 *   ※ 実 BAN（投票無効化）は別途 admin 確認後に手動実行する想定（誤検知防止）。
 *
 * 認証：CRON_SECRET（Bearer）
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPAM_WINDOW_MIN = 5;
const SPAM_THRESHOLD = 5; // 同 fingerprint × universe_id で5分以内に5票以上

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - SPAM_WINDOW_MIN * 60_000).toISOString();

  const { data, error } = await supabase
    .from('game_button_vote_logs')
    .select('fingerprint, universe_id, account_id')
    .eq('button_type', 'recommend')
    .gte('created_at', since);
  if (error) {
    console.error('[detect-spam-votes]', error);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  type Row = { fingerprint: string; universe_id: number; account_id: string | null };
  const rows = (data as Row[] | null) ?? [];

  // fingerprint × universe_id で集計
  const counts = new Map<string, { fp: string; uni: number; accs: Set<string>; n: number }>();
  for (const r of rows) {
    const key = `${r.fingerprint}|${r.universe_id}`;
    let c = counts.get(key);
    if (!c) {
      c = { fp: r.fingerprint, uni: r.universe_id, accs: new Set<string>(), n: 0 };
      counts.set(key, c);
    }
    c.n++;
    if (r.account_id) c.accs.add(r.account_id);
  }

  let logged = 0;
  const candidates = Array.from(counts.values());
  for (const c of candidates) {
    if (c.n < SPAM_THRESHOLD) continue;

    // 既に直近1時間で同じ fingerprint × universe_id の BAN ログがあればスキップ（重複記録回避）
    const recentSince = new Date(Date.now() - 3600_000).toISOString();
    const detail = `fingerprint=${c.fp.slice(0, 8)}…/universe_id=${c.uni}/votes=${c.n}/win=${SPAM_WINDOW_MIN}min`;
    const { data: dup } = await supabase
      .from('moderation_ban_logs')
      .select('id')
      .eq('reason_code', 'spam_vote')
      .eq('reason_detail', detail)
      .gte('banned_at', recentSince)
      .maybeSingle();
    if (dup) continue;

    const accList: string[] = [];
    c.accs.forEach((v) => accList.push(v));
    const targetIdText = accList.join(',') || null;
    const { error: insErr } = await supabase.from('moderation_ban_logs').insert({
      target_type: 'account',
      target_id: 0, // accounts は UUID なので target_id_text を使う
      target_id_text: targetIdText,
      reason_code: 'spam_vote',
      reason_detail: detail,
    });
    if (insErr) {
      console.error('[detect-spam-votes ban_logs insert]', insErr);
      continue;
    }
    logged++;
  }

  return NextResponse.json({ ok: true, scanned: rows.length, ban_logged: logged });
}
