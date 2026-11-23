import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'env-not-configured';

export function hasSupabaseEnv(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// ブラウザ / Server Component から読み取り用途で使う匿名クライアント
export function createBrowserClient(): SupabaseClient {
  return createClient(
    supabaseUrl || FALLBACK_SUPABASE_URL,
    supabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    }
  );
}

// Cron など書き込み権限が必要なサーバーサイド処理専用
// Service Role Keyはクライアントに絶対に渡さない
export function createServiceClient(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * 一括 upsert で「値が undefined の列は送らない（＝既存値を残す）」ための下ごしらえ。
 * 行から undefined のキーを消し、送る列の組み合わせが同じ行ごとに束ねて返す。
 * 呼び出し側は束ごとに upsert する。
 *
 * なぜ束ねる必要があるか：postgrest-js の upsert は配列を渡すと、全行のキーの和集合を
 * columns に指定する（Object.keys なので値が undefined のキーも数える）。一方 JSON 本文からは
 * undefined のキーが落ちるため、どこか 1 行でも欠けた列は NULL 扱いになり、
 * ON CONFLICT で既存値が NULL に上書きされる（@supabase/postgrest-js 2.104.0 で確認）。
 */
export function groupRowsByColumns<T extends Record<string, unknown>>(rows: T[]): Partial<T>[][] {
  const groups = new Map<string, Partial<T>[]>();
  for (const row of rows) {
    const clean = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== undefined)
    ) as Partial<T>;
    const key = Object.keys(clean).sort().join(',');
    const group = groups.get(key);
    if (group) group.push(clean);
    else groups.set(key, [clean]);
  }
  return [...groups.values()];
}
