import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankingRowData } from '@/types/game';
import { genreLabelJa } from '@/lib/genre-labels';
import { hasSupabaseEnv } from '@/lib/supabase';

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
  name_ja: string | null;
  creator_name: string | null;
  thumbnail_url: string | null;
  is_japanese: boolean;
  genre_slug: string | null;
  genre_l1: string | null;
  first_seen_at: string | null;
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
    .select('universe_id, name, name_ja, creator_name, thumbnail_url, is_japanese, genre_slug, genre_l1, first_seen_at')
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

export type RankingFilter = 'overall' | 'japanese' | 'trending' | 'new' | 'category';

export interface RankingOptions {
  /** category フィルタ時の genre_slug */
  categorySlug?: string;
  /** new フィルタ時の期間（日数、デフォルト7） */
  newWithinDays?: number;
}

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
  limit = 100,
  options: RankingOptions = {}
): Promise<RankingResult> {
  if (!hasSupabaseEnv()) return { rows: [], capturedAt: null };
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

  // new フィルタの閾値（UTC基準、日数前）
  const newCutoff = (() => {
    const days = options.newWithinDays ?? 7;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString();
  })();

  // フィルタ適用→順位付け→limit
  const rows: RankingRowData[] = [];
  for (const s of sorted) {
    const g = gameMap.get(s.universe_id);
    if (!g) continue;
    if (filter === 'japanese' && !g.is_japanese) continue;
    if (filter === 'trending' && s.playing < TRENDING_MIN_PLAYING) continue;
    if (filter === 'category') {
      if (!options.categorySlug) continue;
      if (g.genre_slug !== options.categorySlug) continue;
    }
    if (filter === 'new') {
      if (!g.first_seen_at || g.first_seen_at < newCutoff) continue;
    }

    const currentRank = rows.length + 1;
    const prevRank = prevRankMap.get(s.universe_id);
    // 正：順位上昇、負：下降、null：前回不在＝NEW
    const rankDelta =
      prevRank === undefined ? null : prevRank - currentRank;

    rows.push({
      universeId: s.universe_id,
      rank: currentRank,
      name: g.name_ja ?? g.name,
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

export interface CategorySummary {
  slug: string;
  label: string;     // genre_l1 表示名
  gameCount: number; // そのカテゴリのゲーム数
}

/**
 * /categories 一覧ページ用：DB に蓄積されている genre_slug の一覧を返す。
 * ゲーム件数の多い順。
 */
export async function getCategorySummaries(
  supabase: SupabaseClient
): Promise<CategorySummary[]> {
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await supabase
    .from('games')
    .select('genre_slug, genre_l1')
    .not('genre_slug', 'is', null);
  if (error) throw error;

  const counts = new Map<string, { label: string; count: number }>();
  for (const row of (data ?? []) as { genre_slug: string | null; genre_l1: string | null }[]) {
    if (!row.genre_slug) continue;
    const existing = counts.get(row.genre_slug);
    if (existing) {
      existing.count++;
    } else {
      counts.set(row.genre_slug, {
        label: genreLabelJa(row.genre_slug, row.genre_l1),
        count: 1,
      });
    }
  }

  return Array.from(counts.entries())
    .map(([slug, v]) => ({ slug, label: v.label, gameCount: v.count }))
    .sort((a, b) => b.gameCount - a.gameCount);
}
