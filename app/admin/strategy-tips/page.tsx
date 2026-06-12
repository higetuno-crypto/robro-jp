import { createServiceClient } from '@/lib/supabase';
import { STRATEGY_TIP_CATEGORIES, type StrategyTipCategory } from '@/lib/strategy-tips';
import { AdminStrategyTipsClient } from './AdminStrategyTipsClient';

/**
 * 攻略Tips モデレーション（通報キュー）。
 *
 * 表示対象 = 手当てが要る Tips のみ：
 *  - open 通報が付いている Tips（通報キュー本体）
 *  - status が hidden / removed の Tips（自動退避・手動処理済みの復元/再削除用）
 * status=published かつ open 通報なしの Tips は出さない（モデレーション不要）。
 *
 * 認可は middleware.ts の Basic 認証（/admin/*）。読み取りは service client。
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '攻略Tips モデレーション',
  robots: { index: false, follow: false },
};

export type TipStatus = 'published' | 'hidden' | 'removed';

export interface AdminTipReport {
  id: number;
  reason: string;
  detail: string | null;
  createdAt: string;
}

export interface AdminTipRow {
  tipId: number;
  universeId: number;
  gameName: string | null;
  category: StrategyTipCategory;
  bodyJa: string;
  status: TipStatus;
  helpfulCount: number;
  reportCount: number;
  createdAt: string;
  isMemberAuthor: boolean;
  openReports: AdminTipReport[];
}

interface ReportRow {
  id: number;
  tip_id: number;
  reason: string;
  detail: string | null;
  created_at: string;
}

interface TipRow {
  tip_id: number;
  universe_id: number;
  category: StrategyTipCategory;
  body_ja: string;
  status: TipStatus;
  helpful_count: number;
  report_count: number;
  created_at: string;
  account_id: string | null;
}

async function fetchModerationQueue(): Promise<AdminTipRow[]> {
  const supabase = createServiceClient();

  // 1) open 通報をまとめて取得し、tip ごとに束ねる
  const { data: reports, error: rErr } = await supabase
    .from('game_strategy_tip_reports')
    .select('id, tip_id, reason, detail, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (rErr) throw rErr;

  const openByTip = new Map<number, AdminTipReport[]>();
  for (const r of (reports ?? []) as ReportRow[]) {
    const arr = openByTip.get(r.tip_id) ?? [];
    arr.push({ id: r.id, reason: r.reason, detail: r.detail, createdAt: r.created_at });
    openByTip.set(r.tip_id, arr);
  }
  const reportedTipIds = [...openByTip.keys()];

  // 2) 対象 tips：open 通報あり OR status が hidden/removed
  let query = supabase
    .from('game_strategy_tips')
    .select(
      'tip_id, universe_id, category, body_ja, status, helpful_count, report_count, created_at, account_id'
    );
  query =
    reportedTipIds.length > 0
      ? query.or(`status.in.(hidden,removed),tip_id.in.(${reportedTipIds.join(',')})`)
      : query.in('status', ['hidden', 'removed']);
  const { data: tips, error: tErr } = await query;
  if (tErr) throw tErr;
  const tipRows = (tips ?? []) as TipRow[];

  // 3) ゲーム名を引く
  const universeIds = [...new Set(tipRows.map((t) => t.universe_id))];
  const nameByUniverse = new Map<number, string>();
  if (universeIds.length > 0) {
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('universe_id, name')
      .in('universe_id', universeIds);
    if (gErr) throw gErr;
    for (const g of (games ?? []) as Array<{ universe_id: number; name: string }>) {
      nameByUniverse.set(g.universe_id, g.name);
    }
  }

  // 4) 組み立て＋並べ替え：通報ありを先頭（古い通報＝対応優先）、次に hidden/removed を新着順
  const rows: AdminTipRow[] = tipRows.map((t) => ({
    tipId: t.tip_id,
    universeId: t.universe_id,
    gameName: nameByUniverse.get(t.universe_id) ?? null,
    category: t.category,
    bodyJa: t.body_ja,
    status: t.status,
    helpfulCount: t.helpful_count,
    reportCount: t.report_count,
    createdAt: t.created_at,
    isMemberAuthor: t.account_id !== null,
    openReports: openByTip.get(t.tip_id) ?? [],
  }));

  rows.sort((a, b) => {
    const aHas = a.openReports.length > 0 ? 0 : 1;
    const bHas = b.openReports.length > 0 ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    if (aHas === 0) {
      // どちらも通報あり：最古の open 通報が早い順
      return a.openReports[0].createdAt.localeCompare(b.openReports[0].createdAt);
    }
    // どちらも通報なし（hidden/removed）：新着順
    return b.createdAt.localeCompare(a.createdAt);
  });

  return rows;
}

export default async function AdminStrategyTipsPage() {
  const rows = await fetchModerationQueue();
  return (
    <AdminStrategyTipsClient initialRows={rows} categories={STRATEGY_TIP_CATEGORIES} />
  );
}
