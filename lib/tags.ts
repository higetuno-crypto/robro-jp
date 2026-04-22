import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

/**
 * フェーズ6：タグ機能のクエリ・ヘルパー
 *
 * - 自由入力は受け付けない（tag_id は tag_master に存在するものだけ）
 * - 投票は fingerprint（IP hash + UA hash）ベース。将来 account_id 導入時も列は既に予約済
 * - confidence_score = min(1, vote_count / (vote_count + K))、K=10
 */

export const CONFIDENCE_K = 10;

export type TagType = 'official' | 'user_selectable' | 'free';
export type TagGroup =
  | 'format'
  | 'reaction'
  | 'participation'
  | 'caution'
  | 'difficulty'
  | 'vibe'
  | 'genre';

export interface TagMaster {
  tagId: string;
  tagName: string;
  tagType: TagType;
  tagGroup: TagGroup;
  description: string | null;
  isStreamingRelated: boolean;
  sortOrder: number;
}

export interface GameTag extends TagMaster {
  voteCount: number;
  confidenceScore: number;
  lastVotedAt: string | null;
}

export function calcConfidence(voteCount: number): number {
  if (voteCount <= 0) return 0;
  return Math.min(1, voteCount / (voteCount + CONFIDENCE_K));
}

/** fingerprint 生成：IP + User-Agent を SHA-256 でハッシュ */
export function makeFingerprint(ip: string, userAgent: string): string {
  const salt = process.env.FINGERPRINT_SALT ?? 'robro-jp-default-salt';
  return createHash('sha256').update(`${salt}|${ip}|${userAgent}`).digest('hex');
}

/** タグマスタ全件（is_active=TRUE）を取得 */
export async function fetchAllTags(
  supabase: SupabaseClient,
  opts?: { streamingOnly?: boolean }
): Promise<TagMaster[]> {
  let q = supabase
    .from('tag_master')
    .select('tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (opts?.streamingOnly) q = q.eq('is_streaming_related', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapTagRow);
}

/** 指定ゲームのタグ一覧（公式は全件・ユーザータグは得票順TOP N） */
export async function fetchGameTags(
  supabase: SupabaseClient,
  universeId: number,
  opts?: { userTagLimit?: number }
): Promise<{ official: GameTag[]; community: GameTag[] }> {
  const { data, error } = await supabase
    .from('game_tag_votes')
    .select(
      `universe_id, tag_id, vote_count, confidence_score, last_voted_at,
       tag_master!inner(tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, is_active, sort_order)`
    )
    .eq('universe_id', universeId)
    .eq('tag_master.is_active', true);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    vote_count: number;
    confidence_score: number;
    last_voted_at: string;
    tag_master: {
      tag_id: string;
      tag_name: string;
      tag_type: TagType;
      tag_group: TagGroup;
      description: string | null;
      is_streaming_related: boolean;
      sort_order: number;
    };
  }>;

  const official: GameTag[] = [];
  const community: GameTag[] = [];
  for (const r of rows) {
    const tag: GameTag = {
      ...mapTagRow({
        tag_id: r.tag_master.tag_id,
        tag_name: r.tag_master.tag_name,
        tag_type: r.tag_master.tag_type,
        tag_group: r.tag_master.tag_group,
        description: r.tag_master.description,
        is_streaming_related: r.tag_master.is_streaming_related,
        sort_order: r.tag_master.sort_order,
      }),
      voteCount: r.vote_count,
      confidenceScore: r.confidence_score,
      lastVotedAt: r.last_voted_at,
    };
    if (tag.tagType === 'official') official.push(tag);
    else community.push(tag);
  }

  // 公式：sort_order昇順 / ユーザー：confidence降順
  official.sort((a, b) => a.sortOrder - b.sortOrder);
  community.sort((a, b) => b.confidenceScore - a.confidenceScore);

  const limit = opts?.userTagLimit ?? 5;
  return { official, community: community.slice(0, limit) };
}

/** fingerprint が同じ (universe, tag) に24h以内に投票しているかチェック */
export async function hasRecentVote(
  supabase: SupabaseClient,
  universeId: number,
  tagId: string,
  fingerprint: string
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('game_tag_vote_logs')
    .select('id')
    .eq('universe_id', universeId)
    .eq('tag_id', tagId)
    .eq('fingerprint', fingerprint)
    .gte('created_at', since)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** fingerprint の直近 60秒 / 1日の投票数（レートリミット判定用） */
export async function countRecentVotes(
  supabase: SupabaseClient,
  fingerprint: string
): Promise<{ last60s: number; last24h: number }> {
  const now = Date.now();
  const since60 = new Date(now - 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 3600 * 1000).toISOString();
  const { count: c60, error: e60 } = await supabase
    .from('game_tag_vote_logs')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', since60);
  if (e60) throw e60;
  const { count: c24, error: e24 } = await supabase
    .from('game_tag_vote_logs')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', since24);
  if (e24) throw e24;
  return { last60s: c60 ?? 0, last24h: c24 ?? 0 };
}

/**
 * 投票をトランザクション的に適用：
 *  1. game_tag_vote_logs に insert
 *  2. game_tag_votes を upsert（vote_count++ / confidence_score 再計算）
 *
 * 注意：Supabase client では複数文のトランザクションは張れないため、
 * 整合性が厳密に必要になったら RPC（stored procedure）に移す（拡張ガイドライン#5）
 */
export async function castVote(
  supabase: SupabaseClient,
  params: {
    universeId: number;
    tagId: string;
    fingerprint: string;
    accountId?: number | null;
  }
): Promise<{ voteCount: number; confidenceScore: number }> {
  const { universeId, tagId, fingerprint, accountId } = params;

  const { error: logErr } = await supabase.from('game_tag_vote_logs').insert({
    universe_id: universeId,
    tag_id: tagId,
    fingerprint,
    account_id: accountId ?? null,
  });
  if (logErr) throw logErr;

  const { data: existing, error: selErr } = await supabase
    .from('game_tag_votes')
    .select('vote_count')
    .eq('universe_id', universeId)
    .eq('tag_id', tagId)
    .maybeSingle();
  if (selErr) throw selErr;

  const newCount = (existing?.vote_count ?? 0) + 1;
  const newScore = calcConfidence(newCount);

  const { error: upErr } = await supabase.from('game_tag_votes').upsert(
    {
      universe_id: universeId,
      tag_id: tagId,
      vote_count: newCount,
      confidence_score: newScore,
      last_voted_at: new Date().toISOString(),
    },
    { onConflict: 'universe_id,tag_id' }
  );
  if (upErr) throw upErr;

  return { voteCount: newCount, confidenceScore: newScore };
}

function mapTagRow(row: {
  tag_id: string;
  tag_name: string;
  tag_type: TagType;
  tag_group: TagGroup;
  description: string | null;
  is_streaming_related: boolean;
  sort_order: number;
}): TagMaster {
  return {
    tagId: row.tag_id,
    tagName: row.tag_name,
    tagType: row.tag_type,
    tagGroup: row.tag_group,
    description: row.description,
    isStreamingRelated: row.is_streaming_related,
    sortOrder: row.sort_order,
  };
}
