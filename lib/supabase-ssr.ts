import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * フェーズ6：Supabase Auth（Cookieベース）サーバーサイドクライアント。
 *
 * - Server Component / Route Handler から `await createSupabaseServerClient()` を使う
 * - Client Component からは `lib/supabase-browser.ts` の `createSupabaseClientClient()` を使う
 *
 * Next.js 15 以降、`cookies()` は async になったため当関数も async。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'env-not-configured';

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(url || FALLBACK_SUPABASE_URL, anon || FALLBACK_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options) {
        try {
          store.set({ name, value, ...options });
        } catch {
          // Server Component からは set 不可。Route Handler / middleware でのみ動く
        }
      },
      remove(name: string, options) {
        try {
          store.set({ name, value: '', ...options });
        } catch {
          // noop
        }
      },
    },
  });
}

export async function getCurrentUser() {
  if (!url || !anon) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
