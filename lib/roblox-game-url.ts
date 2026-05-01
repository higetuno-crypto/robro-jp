/**
 * Roblox ゲーム URL から placeId をパース
 *
 * 受け付ける形式：
 *   https://www.roblox.com/games/12345/My-Game
 *   https://www.roblox.com/games/12345
 *   https://www.roblox.com/ja/games/12345/My-Game     ← 日本語ロケール
 *   https://www.roblox.com/en-us/games/12345/...
 *   https://roblox.com/games/12345/...
 *   12345（数字のみも許容）
 */
export function parseRobloxPlaceIdFromGameUrl(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 数字のみ：placeId として扱う
  if (/^\d+$/.test(trimmed)) {
    const id = Number.parseInt(trimmed, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!/(^|\.)roblox\.com$/.test(url.hostname)) return null;
  const m = url.pathname.match(/^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/games\/(\d+)(?:\/|$)/i);
  if (!m) return null;
  const id = Number.parseInt(m[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
