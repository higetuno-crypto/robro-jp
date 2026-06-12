import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseEnv, createServiceClient } from './supabase';

/**
 * 攻略Tips（集合知型 UGC）ヘルパー。
 * 仕様：higesakusei/新しい方向性/攻略Tips-MVP設計.md
 *
 * - 匿名投稿可（account_id は NULL 可）。fingerprint をキーに重複・レート判定
 * - 書き込みは migration 0020 の SECURITY DEFINER RPC（service_role 限定）経由：
 *     post_strategy_tip / vote_strategy_tip / report_strategy_tip
 * - 生IPは RPC 内で tip_disclosure_logs（本文と分離）に短期保管される
 */

export const STRATEGY_TIP_CATEGORIES = [
  { key: 'early', label: '序盤の進め方' },
  { key: 'earn', label: '稼ぎ方・効率' },
  { key: 'boss', label: 'ボス・強敵' },
  { key: 'trick', label: '裏技・小技' },
  { key: 'glossary', label: '用語' },
  { key: 'controls', label: '操作のコツ' },
  { key: 'other', label: 'その他' },
] as const;

export type StrategyTipCategory = (typeof STRATEGY_TIP_CATEGORIES)[number]['key'];

export const TIP_BODY_MIN = 10;
export const TIP_BODY_MAX = 300;

export const TIP_REPORT_REASONS = [
  'spam',
  'offensive',
  'wrong_info',
  'offtopic',
  'other',
] as const;
export type TipReportReason = (typeof TIP_REPORT_REASONS)[number];

export interface StrategyTip {
  tipId: number;
  universeId: number;
  category: StrategyTipCategory;
  bodyJa: string;
  helpfulCount: number;
  createdAt: string;
  /** 投稿者がログインユーザーか（UUID は公開しない。匿名/会員の区別表示用） */
  isMemberAuthor: boolean;
}

/** 問いかけ（型）：ゲーム別・カテゴリ別の「呼び水質問」。攻略本文ではなく質問のみ。 */
export interface StrategyTipPrompt {
  promptId: number;
  category: StrategyTipCategory;
  promptJa: string;
}

export function isValidTipCategory(v: unknown): v is StrategyTipCategory {
  return typeof v === 'string' && STRATEGY_TIP_CATEGORIES.some((c) => c.key === v);
}

export function isValidReportReason(v: unknown): v is TipReportReason {
  return typeof v === 'string' && (TIP_REPORT_REASONS as readonly string[]).includes(v);
}

// RPC（post_strategy_tip）が返す base table の行（account_id を含む）
interface TipRpcRow {
  tip_id: number;
  universe_id: number;
  category: StrategyTipCategory;
  body_ja: string;
  helpful_count: number;
  account_id: string | null;
  created_at: string;
}

function mapRpcRow(r: TipRpcRow): StrategyTip {
  return {
    tipId: r.tip_id,
    universeId: r.universe_id,
    category: r.category,
    bodyJa: r.body_ja,
    helpfulCount: r.helpful_count,
    createdAt: r.created_at,
    isMemberAuthor: r.account_id !== null,
  };
}

/**
 * 公開中の攻略Tips一覧（👍降順 → 新着降順）。
 *
 * 公開読み取りは **service client（サーバ専用）** で base table を読み、安全な列だけに
 * マップして返す。account_id / fingerprint はクライアントへ一切出さない（isMemberAuthor の
 * 真偽だけに変換）。anon は base table への RLS ポリシーを持たない（0022）ため直接読めず、
 * この関数はサーバー（Server Component / API route）からのみ呼ばれる。
 */
export async function fetchTips(
  universeId: number,
  opts?: { category?: StrategyTipCategory | 'all'; limit?: number }
): Promise<StrategyTip[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createServiceClient();
  let q = supabase
    .from('game_strategy_tips')
    .select('tip_id, universe_id, category, body_ja, helpful_count, account_id, created_at')
    .eq('universe_id', universeId)
    .eq('status', 'published')
    .order('helpful_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.category && opts.category !== 'all') {
    q = q.eq('category', opts.category);
  }
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as TipRpcRow[]).map(mapRpcRow);
}

/** ゲーム別の公開Tips件数（詳細ページの導線表示用） */
export async function countTips(universeId: number): Promise<number> {
  if (!hasSupabaseEnv()) return 0;
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('game_strategy_tips')
    .select('tip_id', { count: 'exact', head: true })
    .eq('universe_id', universeId)
    .eq('status', 'published');
  if (error) throw error;
  return count ?? 0;
}

/**
 * ゲーム別の問いかけ（型・呼び水質問）一覧。is_active のみ、sort_order 昇順。
 * 公開読み取りは Tips 本体と同じくサーバ専用 service client 経由（anon 公開ポリシーは張らない）。
 */
export async function fetchTipPrompts(universeId: number): Promise<StrategyTipPrompt[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('game_strategy_tip_prompts')
    .select('prompt_id, category, prompt_ja')
    .eq('universe_id', universeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('prompt_id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{
    prompt_id: number;
    category: StrategyTipCategory;
    prompt_ja: string;
  }>).map((r) => ({
    promptId: r.prompt_id,
    category: r.category,
    promptJa: r.prompt_ja,
  }));
}

/** 投稿レート集計（ログインは account_id 優先、匿名は fingerprint） */
export async function countRecentTips(
  supabase: SupabaseClient,
  params: { accountId?: string | null; fingerprint: string }
): Promise<{ last60s: number; last24h: number }> {
  const now = Date.now();
  const since60 = new Date(now - 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 3600 * 1000).toISOString();
  const useAccount = !!params.accountId;
  const column = useAccount ? 'account_id' : 'fingerprint';
  const value = useAccount ? params.accountId! : params.fingerprint;

  const q = () =>
    supabase
      .from('game_strategy_tips')
      .select('tip_id', { count: 'exact', head: true })
      .eq(column, value);

  const { count: c60, error: e60 } = await q().gte('created_at', since60);
  if (e60) throw e60;
  const { count: c24, error: e24 } = await q().gte('created_at', since24);
  if (e24) throw e24;
  return { last60s: c60 ?? 0, last24h: c24 ?? 0 };
}

/** 直近60秒の投票数（fingerprint 単位・投票スパム抑止） */
export async function countRecentTipVotes(
  supabase: SupabaseClient,
  fingerprint: string
): Promise<number> {
  const since60 = new Date(Date.now() - 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('game_strategy_tip_votes')
    .select('tip_id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', since60);
  if (error) throw error;
  return count ?? 0;
}

/** 直近24時間の通報数（fingerprint 単位・通報スパム抑止） */
export async function countRecentTipReports(
  supabase: SupabaseClient,
  fingerprint: string
): Promise<number> {
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase
    .from('game_strategy_tip_reports')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', since24);
  if (error) throw error;
  return count ?? 0;
}

/** 投稿（本文＋開示IP＋監査ログを原子的に書く RPC） */
export async function postTip(
  supabase: SupabaseClient,
  params: {
    universeId: number;
    category: StrategyTipCategory;
    body: string;
    accountId?: string | null;
    fingerprint: string;
    ip: string | null;
    userAgent: string;
  }
): Promise<StrategyTip> {
  const { data, error } = await supabase.rpc('post_strategy_tip', {
    p_universe_id: params.universeId,
    p_category: params.category,
    p_body: params.body,
    p_account_id: params.accountId ?? null,
    p_fingerprint: params.fingerprint,
    p_ip: params.ip,
    p_user_agent: params.userAgent,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as TipRpcRow | null;
  if (!row) throw new Error('post_strategy_tip returned no row');
  return mapRpcRow(row);
}

/** 👍投票（重複は無視。返り値 helpfulCount / isDuplicate） */
export async function voteTip(
  supabase: SupabaseClient,
  params: { tipId: number; accountId?: string | null; fingerprint: string }
): Promise<{ helpfulCount: number; isDuplicate: boolean }> {
  const { data, error } = await supabase.rpc('vote_strategy_tip', {
    p_tip_id: params.tipId,
    p_account_id: params.accountId ?? null,
    p_fingerprint: params.fingerprint,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { new_helpful_count: number; is_duplicate: boolean }
    | null;
  if (!row) throw new Error('vote_strategy_tip returned no row');
  return { helpfulCount: row.new_helpful_count, isDuplicate: row.is_duplicate };
}

/** 通報（閾値到達で自動 hidden）。public へは件数を返さない（gaming 防止） */
export async function reportTip(
  supabase: SupabaseClient,
  params: {
    tipId: number;
    reason: TipReportReason;
    detail?: string | null;
    fingerprint: string;
  }
): Promise<{ autoHidden: boolean }> {
  const { data, error } = await supabase.rpc('report_strategy_tip', {
    p_tip_id: params.tipId,
    p_reason: params.reason,
    p_detail: params.detail ?? null,
    p_fingerprint: params.fingerprint,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { new_report_count: number; auto_hidden: boolean }
    | null;
  if (!row) throw new Error('report_strategy_tip returned no row');
  return { autoHidden: row.auto_hidden };
}
