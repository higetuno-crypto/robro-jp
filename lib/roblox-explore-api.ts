/**
 * Roblox explore-api クライアント
 *
 * 設計変更メモ（2026-04-21）：
 * CLAUDE.md では Rolimons から UniverseId を取得する前提だったが、
 * Rolimons は Cloudflare で自動リクエストをブロックしており
 * サーバー環境からの安定取得が不可能だった。
 * 代替として Roblox 公式の explore-api（認証不要）を使う。
 *
 * 利点：
 * - 認証なしでアクセス可能
 * - universeId + name + playerCount が1リクエストで取れる
 * - 複数の sort（Top Playing Now / Top Trending など）を union できる
 *
 * 注意：
 * - 1 sort あたり 90 件前後しか返らない。500件欲しければ複数 sort を合成する
 * - レスポンスには description / thumbnail が含まれないので、
 *   詳細は lib/roblox-api.ts 経由で別途取得する
 */

const GET_SORT_CONTENT_URL = 'https://apis.roblox.com/explore-api/v1/get-sort-content';

/** CCU系のランキングを返す sort。上位500件欲しいのでこの4つを union する */
const SORT_IDS = [
  'top-playing-now',
  'top-trending',
  'up-and-coming',
  'top-revisited',
];

interface ExploreGame {
  universeId: number;
  rootPlaceId: number;
  name: string;
  playerCount: number;
}

interface GetSortContentResponse {
  games?: ExploreGame[];
  nextPageToken?: string | null;
}

async function fetchSort(sortId: string, sessionId: string): Promise<ExploreGame[]> {
  const url = `${GET_SORT_CONTENT_URL}?sessionId=${encodeURIComponent(sessionId)}&sortId=${sortId}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'robro-jp/0.2 (+https://ro-brojp.com/)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    console.error(`[explore-api] sort=${sortId} failed: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as GetSortContentResponse;
  return json.games ?? [];
}

/**
 * 複数ソートを合成し、UniverseId の重複を排除して返す。
 * 並び順は「最初に登場した sort の順」を優先（≒ Top Playing Now が優先）。
 *
 * @param limit 返却件数の上限（CLAUDE.md準拠で500デフォルト）
 */
export async function fetchTopUniverseIds(limit = 500): Promise<number[]> {
  // sessionId は Roblox側のキャッシュキーとして使われる。日時ベースで十分。
  const sessionId = `robro-jp-${Date.now()}`;

  const seen = new Set<number>();
  const ordered: number[] = [];

  for (const sortId of SORT_IDS) {
    const games = await fetchSort(sortId, sessionId);
    for (const g of games) {
      if (!seen.has(g.universeId) && g.universeId > 0) {
        seen.add(g.universeId);
        ordered.push(g.universeId);
        if (ordered.length >= limit) return ordered;
      }
    }
  }

  return ordered;
}
