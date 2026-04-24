import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * フェーズ6：Supabase Auth（Cookieベース）サーバーサイドクライアント。
 *
 * - Server Component / Route Handler から `createSupabaseServerClient()` を使う
 * - Client Component からは `lib/supabase-browser.ts` の `createSupabaseClientClient()` を使う
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function createSupabaseServerClient(): SupabaseClient {
  const store = cookies();
  return createServerClient(url, anon, {
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
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
