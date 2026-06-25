import type { MetadataRoute } from 'next';
import { createBrowserClient } from '@/lib/supabase';

const BASE_URL = 'https://ro-brojp.com';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    '',
    '/made-in-japan',
    '/trending',
    '/categories',
    '/new',
    '/global',
    '/likes',
    '/saves',
    '/recommends',
    '/featured',
    '/tags',
    '/stream',
    '/creators',
    '/guide',
    '/search',
    '/feedback',
    '/privacy',
    '/terms',
    '/contact',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/trending' ? 'hourly' : 'daily',
    priority: path === '' ? 1 : 0.7,
  }));

  // Supabase の env が無いビルド環境（CI 等）では静的 URL だけ返す。
  // 本番 Vercel では env が必ず設定されているので動的部分も生成される。
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return staticUrls;
  }
  const supabase = createBrowserClient();

  // 上位ゲーム詳細（CCU降順500件まで）
  const games: MetadataRoute.Sitemap = [];
  try {
    const { data } = await supabase
      .from('games')
      .select('universe_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000);
    for (const g of data ?? []) {
      games.push({
        url: `${BASE_URL}/game/${g.universe_id}`,
        lastModified: g.updated_at ? new Date(g.updated_at) : now,
        changeFrequency: 'daily',
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error('[sitemap games]', e);
  }

  // タグ詳細
  const tags: MetadataRoute.Sitemap = [];
  try {
    const { data } = await supabase
      .from('tag_master')
      .select('tag_id')
      .eq('is_active', true);
    for (const t of data ?? []) {
      tags.push({
        url: `${BASE_URL}/tags/${encodeURIComponent(t.tag_id)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  } catch (e) {
    console.error('[sitemap tags]', e);
  }

  // 配信スロット
  const slots: MetadataRoute.Sitemap = [];
  try {
    const { data } = await supabase
      .from('stream_slots')
      .select('slot_key')
      .eq('is_active', true);
    for (const s of data ?? []) {
      slots.push({
        url: `${BASE_URL}/stream/${s.slot_key}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  } catch (e) {
    console.error('[sitemap slots]', e);
  }

  return [...staticUrls, ...games, ...tags, ...slots];
}
