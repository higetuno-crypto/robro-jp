import { createServiceClient } from './supabase';
import { fetchGameDetails } from './roblox-api';
import { detectJapanese } from './japanese-detector';
import type { GameDetail } from './game-detail-query';

/**
 * 検索 → 詳細ページ遷移時の on-demand upsert。
 *
 * ランキング外のゲームを検索結果から開いた場合、games テーブルに該当行が無い。
 * その場合だけ Roblox 公式 API を叩いて games に挿入し、詳細ページとして見られるようにする。
 *
 * 注意：snapshot は入れない（cron がランキング上位のみを管理する責務を尊重）。
 *      よって on-demand 取得ゲームの 24h グラフは空になるが、それは仕様。
 */
export async function ensureGameInDb(
  universeId: number
): Promise<GameDetail | null> {
  try {
    const games = await fetchGameDetails([universeId]);
    if (games.length === 0) return null;
    const g = games[0];

    const j = detectJapanese(g.name, g.description);
    const supabase = createServiceClient();
    const { error } = await supabase.from('games').upsert(
      {
        universe_id: g.id,
        place_id: g.rootPlaceId,
        name: g.name,
        description: g.description,
        creator_name: g.creator?.name ?? null,
        creator_type: g.creator?.type ?? null,
        thumbnail_url: g.thumbnailUrl,
        is_japanese: j.isJapanese,
        japanese_score: j.score,
        genre_l1: g.genre_l1 ?? null,
        genre_slug: g.untranslated_genre_l1 ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'universe_id' }
    );
    if (error) {
      console.error('[ensureGameInDb] upsert error:', error);
      return null;
    }

    return {
      universeId: g.id,
      placeId: g.rootPlaceId,
      name: g.name,
      description: g.description,
      creatorName: g.creator?.name ?? null,
      creatorType: g.creator?.type ?? null,
      thumbnailUrl: g.thumbnailUrl,
      isJapanese: j.isJapanese,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ensureGameInDb] fetch error:', err);
    return null;
  }
}
