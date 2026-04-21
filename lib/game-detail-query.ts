import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 個別ゲーム詳細ページ用のクエリ
 *
 * 24時間グラフは game_snapshots を時系列で取得して Recharts に渡す。
 * データポイント数は cron 10分間隔なら最大 144点／24h。
 */

export interface GameDetail {
  universeId: number;
  placeId: number | null;
  name: string;
  description: string | null;
  creatorName: string | null;
  creatorType: string | null;
  thumbnailUrl: string | null;
  isJapanese: boolean;
  updatedAt: string | null;
}

export interface SnapshotPoint {
  capturedAt: string;
  playing: number;
  visits: number | null;
  favorites: number | null;
}

export async function fetchGameDetail(
  supabase: SupabaseClient,
  universeId: number
): Promise<GameDetail | null> {
  const { data, error } = await supabase
    .from('games')
    .select(
      'universe_id, place_id, name, description, creator_name, creator_type, thumbnail_url, is_japanese, updated_at'
    )
    .eq('universe_id', universeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    universeId: data.universe_id,
    placeId: data.place_id,
    name: data.name,
    description: data.description,
    creatorName: data.creator_name,
    creatorType: data.creator_type,
    thumbnailUrl: data.thumbnail_url,
    isJapanese: data.is_japanese,
    updatedAt: data.updated_at,
  };
}

/** 指定 universeId の直近 hours 時間分のスナップショットを昇順で返す */
export async function fetchRecentSnapshots(
  supabase: SupabaseClient,
  universeId: number,
  hours = 24
): Promise<SnapshotPoint[]> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('game_snapshots')
    .select('captured_at, playing, visits, favorites')
    .eq('universe_id', universeId)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    capturedAt: r.captured_at,
    playing: r.playing,
    visits: r.visits,
    favorites: r.favorites,
  }));
}
