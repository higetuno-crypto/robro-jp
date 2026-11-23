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
  /** サムネ URL。画像が無ければ null、取得自体に失敗したら undefined（＝既存値を上書きしない） */
  thumbnailUrl: string | null | undefined;
  /**
   * Roblox の ja-jp ロケール名（Roblox公式が日本で表示する名前）。
   * 日本語名が無ければ null、取得自体に失敗したら undefined（＝既存値を上書きしない）
   */
  name_ja: string | null | undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ====== 429 の扱い ======
// Roblox の非 Open Cloud API は rate limit が非公開で、ときどき 429 を返す
// （2026-11 実測で fetch-games の 2〜3 割）。CLAUDE.md「429 を正常系として扱い、
// 指数バックオフ＋jitter」に従い、429 は少し待って再試行する。それでもダメな時：
//   - 詳細（英語）… CCU が取れないので RobloxRateLimitError を投げ、cron は見送る
//   - サムネ・日本語名 … 付加情報なので undefined（＝取得失敗）を返して続行する。
//     CCU スナップショットはそのまま書き、呼び出し側はこの 2 列の既存値を残す。
//     （null で返すと「画像・日本語名が無い」と区別できず、既存値を null で上書きして
//       表示から消してしまう。旧実装はこれをやっていた）
// 待ち時間の上限は外部スケジューラのタイムアウト（cron-job.org は 30 秒固定）に収める。
const RATE_LIMIT_MAX_RETRIES = 2;
const RATE_LIMIT_BASE_DELAY_MS = 1000;
const RATE_LIMIT_MAX_DELAY_MS = 5000;

export class RobloxRateLimitError extends Error {
  constructor(url: string) {
    super(
      `Roblox API rate limited (429) after ${RATE_LIMIT_MAX_RETRIES} retries: ${new URL(url).pathname}`
    );
    this.name = 'RobloxRateLimitError';
  }
}

async function fetchRoblox(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    // 429 の本文（数十バイト）は読み捨てて接続を解放する。
    // res.body.cancel() は使わないこと：Next.js の fetch パッチはレスポンスを複製（tee）
    // しており、tee の片側だけを cancel するともう片側が cancel されるまで解決せず、
    // route がログも出さずに止まる（2026-11-23 にローカルで実際に発生）。
    await res.text().catch(() => '');
    if (attempt >= RATE_LIMIT_MAX_RETRIES) throw new RobloxRateLimitError(url);
    // Retry-After（秒）があれば尊重しつつ上限で切り、jitter で再試行の重なりを避ける
    const retryAfterMs = Number(res.headers.get('retry-after')) * 1000;
    const backoffMs = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
    const waitMs =
      Math.min(
        RATE_LIMIT_MAX_DELAY_MS,
        Math.max(backoffMs, Number.isFinite(retryAfterMs) ? retryAfterMs : 0)
      ) +
      Math.random() * (RATE_LIMIT_BASE_DELAY_MS / 2);
    await sleep(waitMs);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchGamesBatch(universeIds: number[]): Promise<RobloxGameDetail[]> {
  const url = `${GAMES_DETAIL_URL}?universeIds=${universeIds.join(',')}`;
  const res = await fetchRoblox(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'robro-jp/0.2 (+https://ro-brojp.com/)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Roblox games API error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as GamesDetailResponse;
  return json.data ?? [];
}

/** 取得に失敗したら null（＝このバッチのサムネは不明。呼び出し側は既存値を残す） */
async function fetchThumbnailsBatch(
  universeIds: number[]
): Promise<Map<number, string | null> | null> {
  const url =
    `${THUMBNAIL_URL}?universeIds=${universeIds.join(',')}` +
    `&size=150x150&format=Png&isCircular=false`;
  let res: Response;
  try {
    res = await fetchRoblox(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'robro-jp/0.2 (+https://ro-brojp.com/)',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    // サムネは取れなくても致命ではない（429 を再試行しきった場合も含む）
    console.error('Roblox thumbnail API fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
  if (!res.ok) {
    console.error(`Roblox thumbnail API error: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as ThumbnailResponse;
  const map = new Map<number, string | null>();
  for (const row of json.data) {
    map.set(row.targetId, row.state === 'Completed' ? row.imageUrl : null);
  }
  return map;
}

/**
 * ja-jp ロケールで games API を叩き、日本語名だけを取り出す。
 * Roblox は公式に Accept-Language ヘッダで実験名/説明をロケール化する。
 * 日本語名は表示用の付加情報なので、失敗しても致命とせず null（＝このバッチの
 * 日本語名は不明）を返す。呼び出し側は既存値を残し、表示は英語 name にフォールバックする。
 */
async function fetchJapaneseNames(
  universeIds: number[]
): Promise<Map<number, string> | null> {
  try {
    const url = `${GAMES_DETAIL_URL}?universeIds=${universeIds.join(',')}`;
    const res = await fetchRoblox(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'robro-jp/0.2 (+https://ro-brojp.com/)',
        Accept: 'application/json',
        'Accept-Language': 'ja-jp,ja;q=0.9',
      },
    });
    if (!res.ok) {
      console.error(`Roblox games API (ja-jp) error: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as GamesDetailResponse;
    const map = new Map<number, string>();
    for (const d of json.data ?? []) {
      if (typeof d.name === 'string' && d.name.length > 0) {
        map.set(d.id, d.name);
      }
    }
    return map;
  } catch (err) {
    // 429 を再試行しきった場合も含む
    console.error('Roblox games API (ja-jp) fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * UniverseIdのリストから、ゲーム詳細＋サムネ＋日本語名をまとめて取得する
 * BATCH_SIZE 件ずつバッチ、バッチ間 BATCH_DELAY_MS ディレイ
 */
export async function fetchGameDetails(
  universeIds: number[]
): Promise<GameWithThumbnail[]> {
  const batches = chunk(universeIds, BATCH_SIZE);
  const results: GameWithThumbnail[] = [];

  for (let i = 0; i < batches.length; i++) {
    const ids = batches[i];
    // 詳細（英語）とサムネは別ホストなので並列で取る。日本語名は詳細と同じ
    // games.roblox.com を叩くので、同時に 2 本投げず詳細の後に回す（429 を誘発しにくくする）
    const [details, thumbs] = await Promise.all([
      fetchGamesBatch(ids),
      fetchThumbnailsBatch(ids),
    ]);
    const jaNames = await fetchJapaneseNames(ids);

    for (const d of details) {
      results.push({
        ...d,
        // バッチの取得に失敗していたら undefined（既存値を残す）、取れていて無ければ null
        thumbnailUrl: thumbs ? (thumbs.get(d.id) ?? null) : undefined,
        name_ja: jaNames ? (jaNames.get(d.id) ?? null) : undefined,
      });
    }

    // 最終バッチ以外はディレイ
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}
