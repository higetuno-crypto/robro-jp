'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'env-not-configured';

export function createSupabaseClientClient(): SupabaseClient {
  return createBrowserClient(url || FALLBACK_SUPABASE_URL, anon || FALLBACK_SUPABASE_ANON_KEY);
}
