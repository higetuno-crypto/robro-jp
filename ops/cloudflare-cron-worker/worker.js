// robro-jp 外部 cron スケジューラ（Cloudflare Workers / Cron Triggers）
//
// ※ このファイルのコメントは行コメントで書いている。cron 式には "*" と "/" が
//    並ぶため、ブロックコメント内に書くとコメントが途中で閉じてしまう。
//
// cron-job.org の代替。違いは：
//   - 自前の Worker なので third-party の管理画面に secret を置かない
//     （Cloudflare の encrypted secret に入る）
//   - 1 分粒度で、GitHub Actions のような無活動停止もスロットリングも無い
//   - 4 endpoint を 1 つの Worker でまとめて面倒を見られる
//
// なぜ必要か：
//   GitHub Actions の schedule は 2026-10-01 に 60 日無活動で自動停止し、
//   復帰後も 10 分指定に対して実測 2〜4.5 時間間隔しか発火しなかった
//   （2026-10-25〜26 実測）。CCU 時系列は 10 分粒度が価値の源泉なので、
//   スケジューラを制御可能な場所に移す。
//
// ──────── セットアップ ────────
// 1. https://dash.cloudflare.com → Workers & Pages → Create → Create Worker
//    名前は robro-jp-cron など。作成後 "Edit code" でこのファイルの内容を貼る。
//
// 2. Settings → Variables and Secrets で以下を登録：
//      CRON_SECRET_EXTERNAL … Secret 型。Vercel に入れた外部用の値と同じもの
//      BASE_URL             … Text 型。https://www.ro-brojp.com
//    ※ BASE_URL は必ず www 付き。apex は www へ 307 され、その際に
//      Authorization ヘッダが落ちて 401 になる。
//
// 3. Settings → Trigger Events → Cron Triggers に 3 本追加
//    （式は下の JOBS のキーと完全に一致させる。1 文字違うと発火しない）：
//      10 分毎  … fetch-games と refresh-voting-scores
//      5 分毎   … detect-spam-votes
//      毎日19時UTC … award-badges（JST 04:00）
//    ※ 無料プランで Cron Triggers は 1 Worker あたり 3 本まで。上記で収まる。
//
// 4. 動作確認：Logs → Begin log stream で各 job の status が 200 になるのを見る。
//
// ──────── ローカル確認（任意） ────────
//    npm i -D wrangler
//    npx wrangler dev worker.js --test-scheduled
//    curl "http://localhost:8787/__scheduled?cron=*%2F10+*+*+*+*"

// cron 式 → その時刻に叩く endpoint の対応。
// job を足す時はここに 1 行足し、Cloudflare 側の Trigger も同じ式で足す。
const JOBS = {
  '*/10 * * * *': [
    { path: '/api/cron/fetch-games', method: 'GET' },
    { path: '/api/cron/refresh-voting-scores', method: 'GET' },
  ],
  '*/5 * * * *': [{ path: '/api/cron/detect-spam-votes', method: 'POST' }],
  '0 19 * * *': [{ path: '/api/cron/award-badges', method: 'POST' }],
};

// Roblox 側の 429 など一時的な失敗は 1 回だけ間を置いて再試行する。
// CLAUDE.md「429 を正常系として扱い、指数バックオフ＋jitter」に沿わせる。
const RETRY_DELAY_MS = 20_000;
const MAX_ATTEMPTS = 2;

async function callEndpoint(env, job) {
  const url = `${env.BASE_URL}${job.path}`;
  const init = {
    method: job.method,
    headers: { authorization: `Bearer ${env.CRON_SECRET_EXTERNAL}` },
    redirect: 'manual', // リダイレクト追従で Authorization が落ちるのを防ぐ
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      const body = await res.text();
      // ログは Cloudflare の log stream に出る。secret は出さない。
      console.log(
        JSON.stringify({
          path: job.path,
          attempt,
          status: res.status,
          body: body.slice(0, 300),
        })
      );
      if (res.ok) return { path: job.path, status: res.status, ok: true };
      if (attempt === MAX_ATTEMPTS) {
        return { path: job.path, status: res.status, ok: false };
      }
    } catch (e) {
      console.log(JSON.stringify({ path: job.path, attempt, error: String(e) }));
      if (attempt === MAX_ATTEMPTS) {
        return { path: job.path, status: 0, ok: false };
      }
    }
    // jitter を入れて再試行が重ならないようにする
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS + Math.random() * 5_000));
  }
}

const handler = {
  async scheduled(event, env, ctx) {
    const jobs = JOBS[event.cron];
    if (!jobs) {
      // Trigger の式と JOBS のキーがずれている時にここへ来る
      console.log(JSON.stringify({ error: 'unmapped cron', cron: event.cron }));
      return;
    }
    if (!env.CRON_SECRET_EXTERNAL || !env.BASE_URL) {
      // 設定漏れで黙って何もしなくなるのを避ける
      console.log(JSON.stringify({ error: 'CRON_SECRET_EXTERNAL / BASE_URL 未設定' }));
      return;
    }
    // endpoint 同士は独立なので並列で叩く
    ctx.waitUntil(
      Promise.all(jobs.map((j) => callEndpoint(env, j))).then((rs) =>
        console.log(JSON.stringify({ cron: event.cron, results: rs }))
      )
    );
  },

  // 疎通確認用。secret は返さない。
  async fetch() {
    return new Response('robro-jp cron worker: ok\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};

export default handler;
