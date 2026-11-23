/**
 * lib/roblox-api.ts の 429 処理と、cron の upsert 下ごしらえの自己検査（ネットワークに出ない）。
 *
 *   npx -y tsx scripts/check-roblox-rate-limit.ts
 *
 * global fetch を差し替えて Roblox の 429 を再現し、次を確かめる：
 *   A. 429 が 2 回続いても 3 回目で取れれば普通に結果を返す
 *   B. 詳細（英語）が 429 のままなら RobloxRateLimitError（再試行は 2 回まで）
 *      → CCU が取れないので cron は見送る
 *   C. 日本語名が 429 のままでも続行し、name_ja は undefined（＝既存値を残す）
 *   D. サムネが 429 のままでも続行し、thumbnailUrl は undefined（同上）
 *   E. 日本語名の 429 以外の失敗も undefined（旧実装は null で既存値を上書きしていた）
 *   F. Retry-After が長くても待ちは上限で切られる（cron-job.org の 30 秒枠を守る）
 *   G. 詳細（英語）と日本語名は同時に投げない
 *   H. Next.js の fetch パッチのように body が tee（複製）されていても、
 *      429 の再試行で止まらない（tee の片側だけ cancel するとハングする）
 *   I. groupRowsByColumns：undefined の列は送らず、列の組み合わせごとに束ねる
 *      （postgrest-js の一括 upsert は欠けた列を NULL で上書きするため）
 * 再試行の待ちを実際に挟むので 30 秒ほどかかる。
 */
import assert from 'node:assert/strict';
import { fetchGameDetails, RobloxRateLimitError } from '../lib/roblox-api';
import { groupRowsByColumns } from '../lib/supabase';

type Kind = 'en' | 'ja' | 'thumb';
type Plan = Partial<Record<Kind, Array<number | { status: number; retryAfter?: string }>>>;

/** Next.js の fetch パッチ（cloneResponse）と同じく、body を tee した片側を返す */
let teeBodies = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const okBody: Record<Kind, unknown> = {
  en: { data: [{ id: 1, rootPlaceId: 10, name: 'Game', description: null, creator: null, playing: 5, visits: 1, favoritedCount: 1 }] },
  ja: { data: [{ id: 1, rootPlaceId: 10, name: 'ゲーム', description: null, creator: null, playing: 5, visits: 1, favoritedCount: 1 }] },
  thumb: { data: [{ targetId: 1, state: 'Completed', imageUrl: 'https://example.invalid/t.png' }] },
};

let calls: Record<Kind, number>;
let enInFlight = 0;
let concurrentJa = false;

/** plan[kind] の n 回目の応答を返す（尽きたら 200）。英語は 50ms かけて「通信中」を作る */
function install(plan: Plan) {
  calls = { en: 0, ja: 0, thumb: 0 };
  concurrentJa = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const kind: Kind = url.includes('thumbnails.roblox.com')
      ? 'thumb'
      : headers['Accept-Language']
        ? 'ja'
        : 'en';
    const step = plan[kind]?.[calls[kind]] ?? 200;
    calls[kind]++;
    if (kind === 'ja' && enInFlight > 0) concurrentJa = true;
    if (kind === 'en') {
      enInFlight++;
      await sleep(50);
      enInFlight--;
    }
    const s = typeof step === 'number' ? { status: step } : step;
    if (s.status === 200) {
      return new Response(JSON.stringify(okBody[kind]), { status: 200 });
    }
    // tee の片割れは誰も読まない＝Next.js 内で cache 用に保持される側の再現
    const body = teeBodies ? new Response('error').body!.tee()[0] : 'error';
    return new Response(body, {
      status: s.status,
      headers: s.retryAfter ? { 'retry-after': s.retryAfter } : {},
    });
  }) as typeof fetch;
}

async function main() {
  // A + G
  install({ en: [429, 429, 200] });
  const a = await fetchGameDetails([1]);
  assert.equal(a.length, 1, 'A: 結果 1 件');
  assert.equal(a[0].name_ja, 'ゲーム', 'A: 日本語名あり');
  assert.equal(a[0].thumbnailUrl, 'https://example.invalid/t.png', 'A: サムネあり');
  assert.equal(calls.en, 3, 'A: 詳細は 3 回（初回 + 再試行 2 回）');
  assert.equal(concurrentJa, false, 'G: 詳細の通信中に日本語名を投げていない');
  console.log('A/G ok');

  // B
  install({ en: [429, 429, 429, 429] });
  await assert.rejects(fetchGameDetails([1]), RobloxRateLimitError, 'B');
  assert.equal(calls.en, 3, 'B: 再試行は 2 回で打ち切る');
  console.log('B ok');

  // C
  install({ ja: [429, 429, 429] });
  const c = await fetchGameDetails([1]);
  assert.equal(c[0].playing, 5, 'C: CCU は取れている');
  assert.equal(c[0].name_ja, undefined, 'C: 日本語名は undefined（既存値を残す）');
  assert.equal(c[0].thumbnailUrl, 'https://example.invalid/t.png', 'C: サムネは取れている');
  console.log('C ok');

  // D
  install({ thumb: [429, 429, 429] });
  const d = await fetchGameDetails([1]);
  assert.equal(d[0].thumbnailUrl, undefined, 'D: サムネは undefined（既存値を残す）');
  assert.equal(d[0].name_ja, 'ゲーム', 'D: 日本語名は取れている');
  console.log('D ok');

  // E
  install({ ja: [500] });
  const e = await fetchGameDetails([1]);
  assert.equal(e[0].name_ja, undefined, 'E: 429 以外の失敗も undefined');
  console.log('E ok');

  // F
  install({ en: [{ status: 429, retryAfter: '120' }] });
  const t0 = Date.now();
  await fetchGameDetails([1]);
  const waited = Date.now() - t0;
  assert.ok(waited < 6000, `F: Retry-After 120 秒でも待ちは上限内（実測 ${waited}ms）`);
  console.log(`F ok (${waited}ms)`);

  // H：止まったら検出できるよう 15 秒で打ち切る
  teeBodies = true;
  install({ en: [429, 200] });
  const h = await Promise.race([
    fetchGameDetails([1]).then(() => 'done'),
    sleep(15_000).then(() => 'hung'),
  ]);
  teeBodies = false;
  assert.equal(h, 'done', 'H: tee された body でも 429 の再試行が完了する');
  console.log('H ok');

  // I
  const groups = groupRowsByColumns([
    { universe_id: 1, playing: 5, name_ja: undefined, thumbnail_url: 'a' },
    { universe_id: 2, playing: 6, name_ja: 'に', thumbnail_url: 'b' },
    { universe_id: 3, playing: 7, name_ja: undefined, thumbnail_url: 'c' },
  ]);
  assert.equal(groups.length, 2, 'I: 列の組み合わせは 2 通り');
  const missing = groups.find((g) => g.some((r) => r.universe_id === 1));
  assert.ok(missing, 'I: id=1 の束がある');
  assert.deepEqual(missing.map((r) => r.universe_id), [1, 3], 'I: id=1 と 3 が同じ束');
  assert.ok(missing.every((r) => !('name_ja' in r)), 'I: undefined の列はキーごと消える');
  const full = groups.find((g) => g.some((r) => r.universe_id === 2));
  assert.equal(full?.[0].name_ja, 'に', 'I: 値のある列は残る');
  console.log('I ok');

  console.log('ALL OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
