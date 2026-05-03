/**
 * Roblox 公式ゲーム検索 API ラッパー
 *
 * CLAUDE.md コンプライアンス：
 *  - 公式に文書化された方法のみ（Creator Terms §7）
 *  - User-Agent に robro-jp と連絡先を含める（身元秘匿しない）
 *  - 429 を正常系として扱い、空配列で返す
 *  - description は短く（200字）受け取り、長期保存しない
 *
 * エンドポイント：
 *  games.roblox.com/v1/games/list?model.keyword=... は無認証 GET で動く
 *  公式 Discover の旧UI が使っていた endpoint。サムネは別途 thumbnails API。
 */

import { TtlCache } from './search-cache';

const SEARCH_URL = 'https://games.roblox.com/v1/games/list';
const THUMBNAIL_URL = 'https://thumbnails.roblox.com/v1/games/icons';
const USER_AGENT = 'robro-jp/0.2 (+https://ro-brojp.com/)';

export interface RobloxSearchHit {
  universeId: number;
  placeId: number | null;
  name: string;
  creatorName: string | null;
  creatorType: 'User' | 'Group' | null;
  playing: number;
  thumbnailUrl: string | null;
}

interface RawGameListItem {
  creatorId: number;
  creatorName: string;
  creatorType: 'User' | 'Group';
  creatorHasVerifiedBadge?: boolean;
  totalUpVotes?: number;
  totalDownVotes?: number;
  universeId: number;
  name: string;
  placeId: number;
  playerCount: number;
  imageToken?: string;
  isSponsored?: boolean;
  nativeAdData?: string;
  isShowSponsoredLabel?: boolean;
  price?: number | null;
  analyticsIdentifier?: string | null;
  gameDescription?: string;
  genre?: string;
}

interface GameListResponse {
  games: RawGameListItem[];
  suggestedKeyword?: string;
  filteredKeyword?: string;
  hasMoreRows?: boolean;
}

interface ThumbnailResponse {
  data: Array<{
    targetId: number;
    state: string;
    imageUrl: string | null;
  }>;
}

const cache = new TtlCache<RobloxSearchHit[]>(200, 5 * 60 * 1000);

/**
 * Roblox 公式 API でキーワード検索する。
 * 失敗時（429含む）は空配列で返す（呼び出し側は DB ヒットのみ表示）。
 */
export async function searchRobloxGames(
  query: string,
  limit = 20
): Promise<RobloxSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `${q}::${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `${SEARCH_URL}?model.keyword=${encodeURIComponent(q)}` +
      `&model.maxRows=${limit}` +
      `&model.startRows=0` +
      `&model.sortToken=&model.gameFilter=&model.timeFilter=0&model.genreFilter=0` +
      `&model.contextCountryRegionId=0&model.contextUniverseId=&model.pageContext.pageId=&model.pageContext.isSeeAllPage=false`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (res.status === 429) {
      console.warn('[roblox-search] 429 rate limited');
      cache.set(cacheKey, []);
      return [];
    }
    if (!res.ok) {
      console.error(`[roblox-search] ${res.status} ${res.statusText}`);
      return [];
    }
    const json = (await res.json()) as GameListResponse;
    const items = (json.games ?? []).filter((g) => !g.isSponsored);

    // サムネを別 API でまとめて取得
    const ids = items.map((g) => g.universeId);
    const thumbs = ids.length > 0 ? await fetchThumbnails(ids) : new Map();

    const hits: RobloxSearchHit[] = items.map((g) => ({
      universeId: g.universeId,
      placeId: g.placeId ?? null,
      name: g.name,
      creatorName: g.creatorName ?? null,
      creatorType: g.creatorType ?? null,
      playing: g.playerCount ?? 0,
      thumbnailUrl: thumbs.get(g.universeId) ?? null,
    }));

    cache.set(cacheKey, hits);
    return hits;
  } catch (err) {
    console.error('[roblox-search] fetch error:', err);
    return [];
  }
}

async function fetchThumbnails(
  universeIds: number[]
): Promise<Map<number, string | null>> {
  try {
    const url =
      `${THUMBNAIL_URL}?universeIds=${universeIds.join(',')}` +
      `&size=150x150&format=Png&isCircular=false`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return new Map();
    const json = (await res.json()) as ThumbnailResponse;
    const map = new Map<number, string | null>();
    for (const row of json.data) {
      map.set(row.targetId, row.state === 'Completed' ? row.imageUrl : null);
    }
    return map;
  } catch {
    return new Map();
  }
}
