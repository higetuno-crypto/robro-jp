import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Cron エンドポイントの Bearer 認証（app/api/cron/* の 5 本で共通）。
 *
 * 背景：
 *   同じ認証チェックが 5 routes にコピーされており、素の `!==` 比較だった。
 *   外部スケジューラ対応で鍵を 2 本にするにあたり、分岐を増やす前に 1 箇所へ寄せた。
 *
 * 受け付ける secret は 2 本（どちらも同じ endpoint を叩ける）：
 *   - CRON_SECRET          … 内部スケジューラ（GitHub Actions / Vercel Cron）
 *   - CRON_SECRET_EXTERNAL … 外部スケジューラ（cron-job.org / Cloudflare Worker）
 *
 * なぜ分けるか：
 *   外部サービスには secret を預けることになる。鍵を分けておけば
 *     a) 外部側が漏れた時、内部（GitHub Actions）を止めずに片方だけ失効できる
 *     b) 逆に内部側を定期ローテーションしても外部サービスの設定を触らずに済む
 *     c) ログで内部/外部どちらの呼び出しか区別できる
 *   権限自体は同じなので、これは「権限の分離」ではなく「鍵の分離」である点に注意。
 *   endpoint 単位で絞る設計も検討したが、外部スケジューラは 4 本すべてを叩く
 *   想定のため絞る意味がなく、設定項目を増やすだけなので採らなかった。
 *
 * 比較方法：
 *   SHA-256 ダイジェスト同士を timingSafeEqual で比較する。
 *   長さが常に 32 byte に揃うため、長さ不一致で早期 return して
 *   secret 長を漏らすことがない（middleware.ts の自前 XOR 実装と同じ意図。
 *   こちらは Node runtime なので node:crypto をそのまま使える）。
 *
 * fail-closed：
 *   env が未設定なら常に不許可。誤設定で全公開になるより閉じる方を選ぶ。
 */

export type CronCaller = 'internal' | 'external';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function matches(provided: string, expected: string | undefined): boolean {
  if (!expected) return false; // 未設定の secret では絶対に通さない
  return timingSafeEqual(sha256(provided), sha256(expected));
}

/**
 * Authorization ヘッダを検証し、どちらの呼び出し元かを返す。
 * 認証できなければ null（呼び出し側で 401 を返す）。
 */
export function authorizeCron(request: Request): CronCaller | null {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);

  // 内部・外部の両方を必ず評価する（短絡させると
  // 「内部鍵が一致したか」が応答時間に出るため）
  const isInternal = matches(token, process.env.CRON_SECRET);
  const isExternal = matches(token, process.env.CRON_SECRET_EXTERNAL);

  if (isInternal) return 'internal';
  if (isExternal) return 'external';
  return null;
}
