/**
 * 表示用フォーマッタ
 * CLAUDE.mdの「更新時刻常時表示」「CCUは tabular-nums」を支える
 */

const nfJP = new Intl.NumberFormat('ja-JP');

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-';
  return nfJP.format(n);
}

/**
 * ISO文字列から「X分前更新」等を日本語で返す。
 * Server Componentでも呼べるよう時刻取得は引数で注入可能に。
 */
export function formatRelativeJa(
  iso: string | null | undefined,
  now: Date = new Date()
): string {
  if (!iso) return '未取得';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '未取得';
  const diffSec = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (diffSec < 60) return `${diffSec}秒前更新`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前更新`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前更新`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前更新`;
}
