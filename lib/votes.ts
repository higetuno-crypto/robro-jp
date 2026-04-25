import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ButtonType } from './ranking-vote';

/**
 * フェーズ8：3ボタン投票（❤️⭐🔥）のDBヘルパー
 *
 * 上位文書：feature-spec.md §3
 *
 * レートリミット：
 *  - 1 account × 1 (universe, button) = 24h内 1票（取り消し→再投票はOK）
 *  - 1 account = 60秒で20票
 *  - 1 account = 1日100票
 */

export const VOTE_LIMIT_PER_MINUTE = 20;
export const VOTE_LIMIT_PER_DAY = 100;

/** fingerprint：万一のアカウント乗っ取り対策。tags.ts と同じハッシュ方式 */
export function makeFingerprint(ip: string, userAgent: string): string {
  const salt = process.env.FINGERPRINT_SALT ?? 'robro-jp-default-salt';
  return createHash('sha256').update(`${salt}|${ip}|${userAgent}`).digest('hex');
}

export interface ButtonVoteCounts {
  like: number;
  save: number;
  recommend: number;
}

export interface UserVoteState {
  like: boolean;
  save: boolean;
  recommend: boolean;
}

/**
 * 集計値（vote_count）取得：閲覧公開のため anon クライアントで読める
 */
export async function fetchGameButtonVotes(
  supabase: SupabaseClient,
  universeId: number
): Promise<ButtonVoteCounts> {
  const { data, error } = await supabase
    .from('game_button_votes')
    .select('button_type, vote_count')
    .eq('universe_id', universeId);
  if (error) throw error;

  const result: ButtonVoteCounts = { like: 0, save: 0, recommend: 0 };
  for (const row of data ?? []) {
    const bt = row.button_type as ButtonType;
    if (bt in result) {
      result[bt] = row.vote_count ?? 0;
    }
  }
  return result;
}

/**
 * ログインユーザー本人の投票状態（24h以内に純投票=1 が立っているか）
 *
 * 同一(universe, button)に「+1, -1, +1」と打たれた場合、最後のレコードの vote_value で判定。
 */
export async function fetchUserVoteState(
  supabase: SupabaseClient,
  universeId: number,
  accountId: string
): Promise<UserVoteState> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('game_button_vote_logs')
    .select('button_type, vote_value, created_at')
    .eq('universe_id', universeId)
    .eq('account_id', accountId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const seen = new Set<ButtonType>();
  const state: UserVoteState = { like: false, save: false, recommend: false };
  for (const row of data ?? []) {
    const bt = row.button_type as ButtonType;
    if (seen.has(bt)) continue;
    seen.add(bt);
    state[bt] = row.vote_value === 1;
  }
  return state;
}

/**
 * レートリミット用のカウント取得（同一アカウントの直近投票数）
 */
export async function countRecentVotesByAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ last60s: number; last24h: number }> {
  const now = Date.now();
  const since60 = new Date(now - 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 3600 * 1000).toISOString();

  const { count: c60, error: e60 } = await supabase
    .from('game_button_vote_logs')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('created_at', since60);
  if (e60) throw e60;

  const { count: c24, error: e24 } = await supabase
    .from('game_button_vote_logs')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('created_at', since24);
  if (e24) throw e24;

  return { last60s: c60 ?? 0, last24h: c24 ?? 0 };
}

/**
 * 24h以内に同じ (universe, button) で純投票（vote_value=1）を打っているか
 */
export async function hasActiveVote(
  supabase: SupabaseClient,
  universeId: number,
  buttonType: ButtonType,
  accountId: string
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('game_button_vote_logs')
    .select('vote_value, created_at')
    .eq('universe_id', universeId)
    .eq('button_type', buttonType)
    .eq('account_id', accountId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0];
  return Boolean(last && last.vote_value === 1);
}

/**
 * 投票を1件記録：
 *   1. game_button_vote_logs に INSERT（vote_value: 1=投票, -1=取り消し）
 *   2. トリガで game_button_votes が自動更新される
 *   3. ⭐の場合は user_savings も連動 INSERT/DELETE
 *
 * 戻り値：投票後の集計カウント
 */
export async function castButtonVote(
  supabase: SupabaseClient,
  params: {
    universeId: number;
    buttonType: ButtonType;
    accountId: string;
    fingerprint: string;
    voteValue: 1 | -1;
  }
): Promise<{ voteCount: number }> {
  const { universeId, buttonType, accountId, fingerprint, voteValue } = params;

  const { error: logErr } = await supabase.from('game_button_vote_logs').insert({
    universe_id: universeId,
    button_type: buttonType,
    account_id: accountId,
    fingerprint,
    vote_value: voteValue,
  });
  if (logErr) throw logErr;

  // ⭐は user_savings に連動
  if (buttonType === 'save') {
    if (voteValue === 1) {
      const { error: usErr } = await supabase.from('user_savings').upsert(
        { account_id: accountId, universe_id: universeId },
        { onConflict: 'account_id,universe_id' }
      );
      if (usErr) console.error('[castButtonVote] user_savings upsert', usErr);
    } else {
      const { error: usDelErr } = await supabase
        .from('user_savings')
        .delete()
        .eq('account_id', accountId)
        .eq('universe_id', universeId);
      if (usDelErr) console.error('[castButtonVote] user_savings delete', usDelErr);
    }
  }

  // 集計値を読み返す（トリガが先に走っているはず）
  const { data, error } = await supabase
    .from('game_button_votes')
    .select('vote_count')
    .eq('universe_id', universeId)
    .eq('button_type', buttonType)
    .maybeSingle();
  if (error) throw error;

  return { voteCount: data?.vote_count ?? 0 };
}
