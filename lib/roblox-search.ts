/**
 * Roblox 公式ゲーム検索 API ラッパー
 *
 * CLAUDE.md コンプライアンス：
 *  - 公式に文書化された方法のみ（Creator Terms §7）
 *  - User-Agent に robro-jp と連絡先を含める（身元秘匿しない）
 *  - 429 を正常系として扱い、空配列で返す
 *  - description は短く受け取り、長期保存しない
 *
 * エンドポイント：
 *  apis.roblox.com/search-api/omni-search が現行の公式 Discover の検索 API。
 *  無認証 GET で動く。pageType=all で全カテゴリ横断検索。
 *  旧 games.roblox.com/v1/games/list は2026時点で 404 撤去済み。
 */

import { TtlCache } from './search-cache';

const SEARCH_URL = 'https://apis.roblox.com/search-api/omni-search';
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

interface OmniContent {
  universeId: number;
  name: string;
  description?: string;
  playerCount?: number;
  creatorName?: string;
  creatorId?: number;
  rootPlaceId?: number;
  isSponsored?: boolean;
  contentType?: string;
  contentId?: number;
}

interface OmniGroup {
  contentGroupType: string;
  contents: OmniContent[];
  topicId?: string;
}

interface OmniSearchResponse {
  searchResults: OmniGroup[];
  nextPageToken?: string;
  vertical?: string;
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
    // sessionId は API が要求するが、anonymous で適当な ID で動く
    const sessionId = `robro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const url =
      `${SEARCH_URL}?searchQuery=${encodeURIComponent(q)}` +
      `&sessionId=${encodeURIComponent(sessionId)}` +
      `&pageType=all`;
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
    const json = (await res.json()) as OmniSearchResponse;

    // ContentGroupType=Game のみ抽出。各 group は contents:[1要素] の構造
    const items: OmniContent[] = [];
    for (const g of json.searchResults ?? []) {
      if (g.contentGroupType !== 'Game') continue;
      for (const c of g.contents ?? []) {
        if (c.isSponsored) continue;
        if (!c.universeId) continue;
        items.push(c);
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }

    if (items.length === 0) {
      cache.set(cacheKey, []);
      return [];
    }

    // サムネを別 API でまとめて取得
    const ids = items.map((c) => c.universeId);
    const thumbs = await fetchThumbnails(ids);

    const hits: RobloxSearchHit[] = items.map((c) => ({
      universeId: c.universeId,
      placeId: c.rootPlaceId ?? null,
      name: c.name,
      creatorName: c.creatorName && c.creatorName.length > 0 ? c.creatorName : null,
      // omni-search は creatorType を返さないため null。後段で気にしない
      creatorType: null,
      playing: c.playerCount ?? 0,
      thumbnailUrl: thumbs.get(c.universeId) ?? null,
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
