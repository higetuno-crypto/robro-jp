import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankingRowData } from '@/types/game';

/**
 * ランキング取得クエリ（Server Component 専用）
 *
 * 設計：
 * - 最新 captured_at と「それより前の captured_at」の2点を取り、順位差を計算
 * - Viewで書くこともできるが、フェーズ2では素直に2クエリ叩く
 * - フェーズ3の「急上昇」では同じ構造で比較元を1時間前等に差し替える
 */

interface SnapshotRow {
  universe_id: number;
  playing: number;
}

interface GameRow {
  universe_id: number;
  name: string;
  creator_name: string | null;
  thumbnail_url: string | null;
  is_japanese: boolean;
}

async function fetchLatestCapturedAt(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('game_snapshots')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.captured_at ?? null;
}

async function fetchSnapshotAt(
  supabase: SupabaseClient,
  capturedAt: string
): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from('game_snapshots')
    .select('universe_id, playing')
    .eq('captured_at', capturedAt);
  if (error) throw error;
  return data ?? [];
}

/** 最新より前で、最も近い captured_at を取得（無ければ null） */
async function fetchPreviousCapturedAt(
  supabase: SupabaseClient,
  latest: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('game_snapshots')
    .select('captured_at')
    .lt('captured_at', latest)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.captured_at ?? null;
}

async function fetchGames(
  supabase: SupabaseClient,
  universeIds: number[]
): Promise<Map<number, GameRow>> {
  if (universeIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('games')
    .select('universe_id, name, creator_name, thumbnail_url, is_japanese')
    .in('universe_id', universeIds);
  if (error) throw error;
  const map = new Map<number, GameRow>();
  for (const g of (data ?? []) as GameRow[]) map.set(g.universe_id, g);
  return map;
}

export interface RankingResult {
  rows: RankingRowData[];
  capturedAt: string | null;
}

export type RankingFilter = 'overall' | 'japanese' | 'trending';

/**
 * 急上昇スコア：min〜maxのクリップをかけた「倍率上昇」。
 * 小規模ゲームがたまたま2人→20人で10倍になる現象を抑えるため、
 * min_playing を加えてスムージングする。
 *
 * growthScore = (current + K) / (previous + K)
 *   K = 100  ← CCU 100人未満のノイズを潰す
 * さらに current が低すぎるものは足切り（current >= 50）。
 */
const TRENDING_SMOOTHING_K = 100;
const TRENDING_MIN_PLAYING = 50;

/**
 * 指定フィルタで上位 limit 件のランキングを返す。
 * 変動は前スナップショットとの順位差から算出。
 */
export async function getRanking(
  supabase: SupabaseClient,
  filter: RankingFilter = 'overall',
  limit = 100
): Promise<RankingResult> {
  const latest = await fetchLatestCapturedAt(supabase);
  if (!latest) return { rows: [], capturedAt: null };

  const [latestSnaps, prevCapturedAt] = await Promise.all([
    fetchSnapshotAt(supabase, latest),
    fetchPreviousCapturedAt(supabase, latest),
  ]);
  const prevSnaps = prevCapturedAt
    ? await fetchSnapshotAt(supabase, prevCapturedAt)
    : [];

  // 前スナップでの順位マップ（playing降順に並べてインデックス+1を順位とする）
  const prevRankMap = new Map<number, number>();
  prevSnaps
    .slice()
    .sort((a, b) => b.playing - a.playing)
    .forEach((s, i) => prevRankMap.set(s.universe_id, i + 1));

  // prev playing lookup（trending計算用）
  const prevPlayingMap = new Map<number, number>();
  for (const s of prevSnaps) prevPlayingMap.set(s.universe_id, s.playing);

  // 並び替え：trending の場合は growthScore 降順、それ以外は playing 降順
  const sorted = latestSnaps.slice().sort((a, b) => {
    if (filter === 'trending') {
      const ga =
        (a.playing + TRENDING_SMOOTHING_K) /
        ((prevPlayingMap.get(a.universe_id) ?? a.playing) + TRENDING_SMOOTHING_K);
      const gb =
        (b.playing + TRENDING_SMOOTHING_K) /
        ((prevPlayingMap.get(b.universe_id) ?? b.playing) + TRENDING_SMOOTHING_K);
      return gb - ga;
    }
    return b.playing - a.playing;
  });

  // games マスタを一括取得
  const gameMap = await fetchGames(
    supabase,
    sorted.map((s) => s.universe_id)
  );

  // フィルタ適用→順位付け→limit
  const rows: RankingRowData[] = [];
  for (const s of sorted) {
    const g = gameMap.get(s.universe_id);
    if (!g) continue;
    if (filter === 'japanese' && !g.is_japanese) continue;
    if (filter === 'trending' && s.playing < TRENDING_MIN_PLAYING) continue;

    const currentRank = rows.length + 1;
    const prevRank = prevRankMap.get(s.universe_id);
    // 正：順位上昇、負：下降、null：前回不在＝NEW
    const rankDelta =
      prevRank === undefined ? null : prevRank - currentRank;

    rows.push({
      universeId: s.universe_id,
      rank: currentRank,
      name: g.name,
      creatorName: g.creator_name,
      thumbnailUrl: g.thumbnail_url,
      playing: s.playing,
      rankDelta,
      isJapanese: g.is_japanese,
    });

    if (rows.length >= limit) break;
  }

  return { rows, capturedAt: latest };
}
