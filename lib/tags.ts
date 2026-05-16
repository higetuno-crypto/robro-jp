import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { hasSupabaseEnv } from './supabase';

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
  if (!hasSupabaseEnv()) return [];
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
  if (!hasSupabaseEnv()) return { official: [], community: [] };
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

/**
 * 直近 60秒 / 1日の投票数。
 * accountId が与えられればそれを優先（ログイン済み = アプリの本来想定）。
 * fingerprint フォールバックは、ログ前提を維持するための互換用。
 */
export async function countRecentVotes(
  supabase: SupabaseClient,
  params: { accountId?: string | null; fingerprint?: string | null }
): Promise<{ last60s: number; last24h: number }> {
  const now = Date.now();
  const since60 = new Date(now - 60 * 1000).toISOString();
  const since24 = new Date(now - 24 * 3600 * 1000).toISOString();

  const useAccount = !!params.accountId;
  const column = useAccount ? 'account_id' : 'fingerprint';
  const value = useAccount ? params.accountId! : params.fingerprint ?? '';

  const { count: c60, error: e60 } = await supabase
    .from('game_tag_vote_logs')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', since60);
  if (e60) throw e60;
  const { count: c24, error: e24 } = await supabase
    .from('game_tag_vote_logs')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', since24);
  if (e24) throw e24;
  return { last60s: c60 ?? 0, last24h: c24 ?? 0 };
}

/**
 * 投票を DB 側で原子的に適用する。
 * migration 0015 の `cast_tag_vote` RPC を呼び、ログ INSERT と集計の +1 を
 * 同一トランザクションで処理する（lost update を回避）。
 * 24h 内の重複判定もアカウント優先で行う：
 *   - account_id が non-null なら account_id ベース
 *   - そうでなければ fingerprint ベース
 */
export async function castVote(
  supabase: SupabaseClient,
  params: {
    universeId: number;
    tagId: string;
    fingerprint: string;
    accountId?: string | null;
  }
): Promise<{ voteCount: number; confidenceScore: number; isDuplicate: boolean }> {
  const { universeId, tagId, fingerprint, accountId } = params;

  const { data, error } = await supabase.rpc('cast_tag_vote', {
    p_universe_id: universeId,
    p_tag_id: tagId,
    p_account_id: accountId ?? null,
    p_fingerprint: fingerprint,
  });
  if (error) throw error;

  // RPC は SETOF を返すので配列の先頭を取る
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('cast_tag_vote returned no row');
  }
  return {
    voteCount: row.vote_count as number,
    confidenceScore: row.confidence_score as number,
    isDuplicate: row.is_duplicate as boolean,
  };
}

/** /tags 一覧用：タグマスタ + 集計（総得票数・紐付くゲーム数） */
export interface TagStats extends TagMaster {
  totalVoteCount: number;
  gameCount: number;
  createdAt: string | null;
}

export async function fetchTagsWithStats(
  supabase: SupabaseClient
): Promise<TagStats[]> {
  if (!hasSupabaseEnv()) return [];
  const { data: tags, error: tErr } = await supabase
    .from('tag_master')
    .select('tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, sort_order, created_at')
    .eq('is_active', true);
  if (tErr) throw tErr;

  const { data: votes, error: vErr } = await supabase
    .from('game_tag_votes')
    .select('tag_id, vote_count');
  if (vErr) throw vErr;

  const agg = new Map<string, { total: number; games: number }>();
  for (const v of (votes ?? []) as { tag_id: string; vote_count: number }[]) {
    const cur = agg.get(v.tag_id) ?? { total: 0, games: 0 };
    cur.total += v.vote_count;
    if (v.vote_count > 0) cur.games += 1;
    agg.set(v.tag_id, cur);
  }

  return ((tags ?? []) as Array<{
    tag_id: string;
    tag_name: string;
    tag_type: TagType;
    tag_group: TagGroup;
    description: string | null;
    is_streaming_related: boolean;
    sort_order: number;
    created_at: string | null;
  }>).map((t) => {
    const a = agg.get(t.tag_id) ?? { total: 0, games: 0 };
    return {
      ...mapTagRow(t),
      totalVoteCount: a.total,
      gameCount: a.games,
      createdAt: t.created_at,
    };
  });
}

export async function fetchTagBySlug(
  supabase: SupabaseClient,
  tagId: string
): Promise<TagStats | null> {
  if (!hasSupabaseEnv()) return null;
  const { data, error } = await supabase
    .from('tag_master')
    .select('tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, sort_order, created_at')
    .eq('tag_id', tagId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: votes, error: vErr } = await supabase
    .from('game_tag_votes')
    .select('vote_count')
    .eq('tag_id', tagId);
  if (vErr) throw vErr;

  const rows = (votes ?? []) as { vote_count: number }[];
  const totalVoteCount = rows.reduce((s, r) => s + r.vote_count, 0);
  const gameCount = rows.filter((r) => r.vote_count > 0).length;

  return {
    ...mapTagRow(data as Parameters<typeof mapTagRow>[0]),
    totalVoteCount,
    gameCount,
    createdAt: (data as { created_at: string | null }).created_at,
  };
}

/** タグ詳細ページ用：該当タグを付けられたゲームを得票の確信度順で返す */
export interface TagGameRow {
  universeId: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  isJapanese: boolean;
  playing: number | null;
  voteCount: number;
  confidenceScore: number;
}

export async function fetchGamesForTag(
  supabase: SupabaseClient,
  tagId: string,
  limit = 50
): Promise<TagGameRow[]> {
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await supabase
    .from('game_tag_votes')
    .select(
      `universe_id, vote_count, confidence_score,
       games!inner(universe_id, name, creator_name, thumbnail_url, is_japanese)`
    )
    .eq('tag_id', tagId)
    .gt('vote_count', 0)
    .order('confidence_score', { ascending: false })
    .order('vote_count', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    universe_id: number;
    vote_count: number;
    confidence_score: number;
    games: {
      universe_id: number;
      name: string;
      creator_name: string | null;
      thumbnail_url: string | null;
      is_japanese: boolean;
    };
  }>;

  if (rows.length === 0) return [];

  // 現在CCUを別途最新スナップショットから引く
  const latestSnap = await supabase
    .from('game_snapshots')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const capturedAt = latestSnap.data?.captured_at ?? null;

  const playingMap = new Map<number, number>();
  if (capturedAt) {
    const { data: snaps } = await supabase
      .from('game_snapshots')
      .select('universe_id, playing')
      .eq('captured_at', capturedAt)
      .in('universe_id', rows.map((r) => r.universe_id));
    for (const s of (snaps ?? []) as { universe_id: number; playing: number }[]) {
      playingMap.set(s.universe_id, s.playing);
    }
  }

  return rows.map((r) => ({
    universeId: r.universe_id,
    name: r.games.name,
    creatorName: r.games.creator_name,
    thumbnailUrl: r.games.thumbnail_url,
    isJapanese: r.games.is_japanese,
    playing: playingMap.get(r.universe_id) ?? null,
    voteCount: r.vote_count,
    confidenceScore: r.confidence_score,
  }));
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
