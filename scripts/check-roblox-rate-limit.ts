/**
 * lib/roblox-api.ts の 429 処理の自己検査（ネットワークに出ない）。
 *
 *   npx -y tsx scripts/check-roblox-rate-limit.ts
 *
 * global fetch を差し替えて Roblox の 429 を再現し、次を確かめる：
 *   A. 429 が 2 回続いても 3 回目で取れれば普通に結果を返す
 *   B. 詳細 API が 429 のままなら RobloxRateLimitError（再試行は 2 回まで）
 *   C. 日本語名 API が 429 のままなら RobloxRateLimitError（null で黙って返さない）
 *   D. サムネ API が 429 のままなら RobloxRateLimitError（同上）
 *   E. 日本語名 API の 429 以外の失敗は従来どおり null で続行する
 *   F. Retry-After が長くても待ちは上限で切られる（cron-job.org の 30 秒枠を守る）
 *   G. 詳細（英語）と日本語名は同時に投げない
 *   H. Next.js の fetch パッチのように body が tee（複製）されていても、
 *      429 の再試行で止まらない（tee の片側だけ cancel するとハングする）
 * 再試行の待ちを実際に挟むので 20 秒ほどかかる。
 */
import assert from 'node:assert/strict';
import { fetchGameDetails, RobloxRateLimitError } from '../lib/roblox-api';

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
    // tee の片割れ b は誰も読まない＝Next.js 内で cache 用に保持される側の再現
    const body = teeBodies ? new Response('error').body!.tee()[0] : 'error';
    return new Response(body, {
      status: s.status,
      headers: s.retryAfter ? { 'retry-after': s.retryAfter } : {},
    });
  }) as typeof fetch;
}

async function expectRateLimit(label: string) {
  await assert.rejects(fetchGameDetails([1]), RobloxRateLimitError, label);
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
  await expectRateLimit('B');
  assert.equal(calls.en, 3, 'B: 再試行は 2 回で打ち切る');
  console.log('B ok');

  // C
  install({ ja: [429, 429, 429] });
  await expectRateLimit('C');
  console.log('C ok');

  // D
  install({ thumb: [429, 429, 429] });
  await expectRateLimit('D');
  console.log('D ok');

  // E
  install({ ja: [500] });
  const e = await fetchGameDetails([1]);
  assert.equal(e.length, 1, 'E: 結果は返る');
  assert.equal(e[0].name_ja, null, 'E: 429 以外の失敗は従来どおり null');
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

  console.log('ALL OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
