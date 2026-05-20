import type { SupabaseClient } from '@supabase/supabase-js';
import type { ButtonType } from './ranking-vote';
import { hasSupabaseEnv } from './supabase';

/**
 * フェーズ8：ボタン別ランキング（❤️/⭐/🔥）クエリ
 *
 * game_voting_scores マテビュー（10分ごとに REFRESH）から、
 * 各ボタンの bayesian_score 降順で上位を取得する。
 *
 * 上位文書：idea-evaluation-v3.md §B5（4種ランキング）
 */

export interface VoteRankingRow {
  universeId: number;
  rank: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  isJapanese: boolean;
  /** 表示する票数（ボタン別） */
  voteCount: number;
}

export interface VoteRankingResult {
  rows: VoteRankingRow[];
  /** マテビューの最終更新時刻に近い目安（last_voted_at の最大値） */
  refreshedAt: string | null;
}

interface ScoreRow {
  universe_id: number;
  is_japanese: boolean;
  like_score: number;
  save_score: number;
  recommend_score: number;
  like_count: number;
  save_count: number;
  recommend_count: number;
  total_votes: number;
}

interface GameMini {
  universe_id: number;
  name: string;
  name_ja: string | null;
  creator_name: string | null;
  thumbnail_url: string | null;
}

/**
 * 指定ボタンのランキング上位を返す。
 * - bayesian_score 降順、同点は vote_count 降順、universe_id 昇順
 * - 票が1件もないゲームは除外（vote_count = 0）
 * - jpOnly=true で is_japanese 限定
 */
export async function getVoteRanking(
  supabase: SupabaseClient,
  buttonType: ButtonType,
  options?: { limit?: number; jpOnly?: boolean }
): Promise<VoteRankingResult> {
  if (!hasSupabaseEnv()) return { rows: [], refreshedAt: null };
  const limit = options?.limit ?? 100;
  const scoreCol =
    buttonType === 'like'
      ? 'like_score'
      : buttonType === 'save'
      ? 'save_score'
      : 'recommend_score';
  const countCol =
    buttonType === 'like'
      ? 'like_count'
      : buttonType === 'save'
      ? 'save_count'
      : 'recommend_count';

  let q = supabase
    .from('game_voting_scores')
    .select(
      'universe_id, is_japanese, like_score, save_score, recommend_score, like_count, save_count, recommend_count, total_votes'
    )
    .gt(countCol, 0)
    .order(scoreCol, { ascending: false })
    .order(countCol, { ascending: false })
    .limit(limit);

  if (options?.jpOnly) {
    q = q.eq('is_japanese', true);
  }

  const { data: scores, error } = await q;
  if (error) throw error;

  const scoreRows = (scores ?? []) as ScoreRow[];
  if (scoreRows.length === 0) return { rows: [], refreshedAt: null };

  const universeIds = scoreRows.map((r) => r.universe_id);
  const { data: games, error: gErr } = await supabase
    .from('games')
    .select('universe_id, name, name_ja, creator_name, thumbnail_url')
    .in('universe_id', universeIds);
  if (gErr) throw gErr;

  const gameMap = new Map<number, GameMini>();
  for (const g of (games ?? []) as GameMini[]) gameMap.set(g.universe_id, g);

  const rows: VoteRankingRow[] = [];
  for (const s of scoreRows) {
    const g = gameMap.get(s.universe_id);
    if (!g) continue;
    const count =
      buttonType === 'like'
        ? s.like_count
        : buttonType === 'save'
        ? s.save_count
        : s.recommend_count;
    rows.push({
      universeId: s.universe_id,
      rank: rows.length + 1,
      name: g.name_ja ?? g.name,
      creatorName: g.creator_name,
      thumbnailUrl: g.thumbnail_url,
      isJapanese: s.is_japanese,
      voteCount: count,
    });
  }

  return { rows, refreshedAt: null };
}
