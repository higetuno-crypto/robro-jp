import 'server-only';

/**
 * フェーズ10：クリエイター本人確認（Robloxプロフィール description 照合方式）
 *
 * 重要な原則（feature-spec.md §5.2.1 / CLAUDE.md 必須UI表記#3）：
 *  - Roblox の `users.roblox.com/v1/users/{id}` を one-shot fetch
 *  - description 本文は永続化しない（一致判定のみ・関数を抜けたら GC される）
 *  - パスワード／.ROBLOSECURITY Cookie／アクセストークンの入力を求めない
 *
 * Creator Third-Party App Policy「Do not build profiles for Roblox Users」順守。
 */

const USERS_API = 'https://users.roblox.com/v1/users';
const UA = 'robro-jp/0.2 (+https://robro-jp.vercel.app/) creator-verify';

/**
 * Roblox プロフィール URL から userId をパース
 * 受け付ける形式：
 *   https://www.roblox.com/users/123456/profile
 *   https://www.roblox.com/users/123456
 *   https://roblox.com/users/123456/...
 */
export function parseRobloxUserIdFromProfileUrl(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!/(^|\.)roblox\.com$/.test(url.hostname)) return null;
  const m = url.pathname.match(/^\/users\/(\d+)(?:\/|$)/);
  if (!m) return null;
  const id = Number.parseInt(m[1], 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

/** 8文字ランダム英数大文字（紛らわしい I O 0 1 を除外） */
export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `robro-verify-${s}`;
}

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  description?: string;
}

/**
 * Roblox 公式 users API から Roblox ユーザー情報を取得。
 * description は照合用にメモリ上で扱うのみで、戻り値からは省く。
 */
export async function fetchRobloxUserBasic(
  robloxUserId: number
): Promise<{ name: string; displayName: string } | null> {
  try {
    const res = await fetch(`${USERS_API}/${robloxUserId}`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RobloxUser;
    if (!data || typeof data.name !== 'string') return null;
    return { name: data.name, displayName: data.displayName ?? data.name };
  } catch (e) {
    console.error('[fetchRobloxUserBasic]', e);
    return null;
  }
}

/**
 * Roblox プロフィール description に確認コードが含まれているかを one-shot で判定。
 * description 本文は呼び出し元に返さない（プロファイリング禁止に整合）。
 */
export async function verifyRobloxDescriptionContainsCode(
  robloxUserId: number,
  expectedCode: string
): Promise<boolean> {
  if (!expectedCode || expectedCode.length < 4) return false;
  try {
    const res = await fetch(`${USERS_API}/${robloxUserId}`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as RobloxUser;
    const description = typeof data.description === 'string' ? data.description : '';
    return description.includes(expectedCode);
    // ここで description 変数は関数スコープを抜けて GC される。DB には書かない。
  } catch (e) {
    console.error('[verifyRobloxDescriptionContainsCode]', e);
    return false;
  }
}
