import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ピックアップ（/featured）用のクエリ
 *
 * featured_games（編集者手動）と games（マスタ）を JOIN する。
 * Supabase は .select('...,games(...)' ) のネスト構文で一発で取れる。
 */

export interface FeaturedItem {
  id: number;
  universeId: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  headline: string;
  comment: string;
  featuredAt: string;
}

interface Row {
  id: number;
  universe_id: number;
  headline: string;
  comment: string;
  display_order: number;
  featured_at: string;
  games: {
    universe_id: number;
    name: string;
    creator_name: string | null;
    thumbnail_url: string | null;
  } | null;
}

export async function fetchFeatured(
  supabase: SupabaseClient,
  limit = 20
): Promise<FeaturedItem[]> {
  const { data, error } = await supabase
    .from('featured_games')
    .select(
      'id, universe_id, headline, comment, display_order, featured_at, games(universe_id, name, creator_name, thumbnail_url)'
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('featured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const items: FeaturedItem[] = [];
  for (const r of rows) {
    if (!r.games) continue;
    items.push({
      id: r.id,
      universeId: r.universe_id,
      name: r.games.name,
      creatorName: r.games.creator_name,
      thumbnailUrl: r.games.thumbnail_url,
      headline: r.headline,
      comment: r.comment,
      featuredAt: r.featured_at,
    });
  }
  return items;
}
