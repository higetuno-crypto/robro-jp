/**
 * Roblox 公式API クライアント
 *
 * CLAUDE.md 外部API規約：
 * - UniverseId 100件/リクエスト
 * - バッチ間 500ms ディレイ
 * - プロキシ禁止（rprxy.xyz等NG）
 * - サムネはCDN直リンク
 */

const GAMES_DETAIL_URL = 'https://games.roblox.com/v1/games';
const THUMBNAIL_URL = 'https://thumbnails.roblox.com/v1/games/icons';
// 以前は100件/reqだったが、2026年時点でRoblox側の上限が引き下げられている。
// 50件に抑えて「Too many universe IDs were requested」エラーを回避。
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

// /v1/games?universeIds=1,2,3 のレスポンス
interface RobloxGameDetail {
  id: number;                // universeId
  rootPlaceId: number | null;
  name: string;
  description: string | null;
  creator: { id: number; name: string; type: 'User' | 'Group' } | null;
  playing: number;
  visits: number;
  favoritedCount: number;
  // ジャンル（カテゴリ別ランキングで使用）。旧 genre は legacy。
  genre_l1?: string | null;              // 表示用：'Roleplay & Avatar Sim' など
  untranslated_genre_l1?: string | null; // URL slug用：'roleplay_and_avatar_sim' など
}

interface GamesDetailResponse {
  data: RobloxGameDetail[];
}

interface ThumbnailResponse {
  data: Array<{
    targetId: number;
    state: string;
    imageUrl: string | null;
  }>;
}

/** Rolimonsから貰ったUniverseIdで公式APIを叩き、詳細とサムネを取得 */
export interface GameWithThumbnail extends RobloxGameDetail {
  thumbnailUrl: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchGamesBatch(universeIds: number[]): Promise<RobloxGameDetail[]> {
  const url = `${GAMES_DETAIL_URL}?universeIds=${universeIds.join(',')}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'robro-jp/0.2 (+https://robro-jp.vercel.app/)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Roblox games API error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as GamesDetailResponse;
  return json.data ?? [];
}

async function fetchThumbnailsBatch(
  universeIds: number[]
): Promise<Map<number, string | null>> {
  const url =
    `${THUMBNAIL_URL}?universeIds=${universeIds.join(',')}` +
    `&size=150x150&format=Png&isCircular=false`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'robro-jp/0.2 (+https://robro-jp.vercel.app/)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    // サムネは取れなくても致命ではないので空で返す
    console.error(`Roblox thumbnail API error: ${res.status}`);
    return new Map();
  }
  const json = (await res.json()) as ThumbnailResponse;
  const map = new Map<number, string | null>();
  for (const row of json.data) {
    map.set(row.targetId, row.state === 'Completed' ? row.imageUrl : null);
  }
  return map;
}

/**
 * UniverseIdのリストから、ゲーム詳細＋サムネをまとめて取得する
 * 100件ずつバッチ、バッチ間500msディレイ
 */
export async function fetchGameDetails(
  universeIds: number[]
): Promise<GameWithThumbnail[]> {
  const batches = chunk(universeIds, BATCH_SIZE);
  const results: GameWithThumbnail[] = [];

  for (let i = 0; i < batches.length; i++) {
    const ids = batches[i];
    // 詳細とサムネを並列で取得（同じバッチ内なので公式APIへの同時負荷は2req）
    const [details, thumbs] = await Promise.all([
      fetchGamesBatch(ids),
      fetchThumbnailsBatch(ids),
    ]);

    for (const d of details) {
      results.push({ ...d, thumbnailUrl: thumbs.get(d.id) ?? null });
    }

    // 最終バッチ以外はディレイ
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}
