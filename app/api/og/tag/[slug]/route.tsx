import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

// 注意：edge runtime では node:crypto が無いため lib/tags.ts は import しない。
//       Supabase へ直接クエリして必要最小限のフィールドだけ拾う。
export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = decodeURIComponent(params.slug);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false } }
  );
  const { data: tag } = await supabase
    .from('tag_master')
    .select('tag_id, tag_name, description, tag_type')
    .eq('tag_id', slug)
    .maybeSingle();

  const title = (tag as { tag_name?: string } | null)?.tag_name ?? slug;
  const desc =
    (tag as { description?: string | null } | null)?.description ??
    '日本語ユーザー向け Roblox ゲームを目的別に発見できるタグページ';
  const isOfficial = (tag as { tag_type?: string } | null)?.tag_type === 'official';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#0b0b0b',
          color: '#f5f5f5',
          padding: '56px 64px',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 22, opacity: 0.7 }}
        >
          <div>robro-jp — タグで Roblox を探す</div>
          <div style={{ display: 'flex', border: '2px solid #f5f5f5', padding: '6px 14px', fontSize: 22 }}>
            {isOfficial ? '公式タグ' : 'ユーザータグ'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: '#f5f5f5',
              color: '#0b0b0b',
              fontSize: 56,
              fontWeight: 700,
              padding: '14px 28px',
            }}
          >
            #{title}
          </div>
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.4,
              opacity: 0.92,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {desc}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 22, opacity: 0.65 }}>
          日本人向け Roblox 発見サイト ro-brojp.com
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}
