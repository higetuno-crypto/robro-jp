import { ImageResponse } from 'next/og';
import { createBrowserClient } from '@/lib/supabase';
import { fetchStreamingMeta, pickBadges, englishBarrierLabel } from '@/lib/streaming';

/**
 * /api/og/game/[universeId] — ゲーム用OG画像（1200x630）
 *
 * 内容：
 *  - ゲーム名
 *  - 日本語一言ピッチ（stream-meta があれば short_pitch_ja）
 *  - 配信向けバッジ最大3つ
 *  - 英語ハードル（あれば）
 *  - ro-bro.jp ロゴテキスト
 *
 * キャッシュ：1h、SWR 24h
 */

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

const BADGE_LABELS: Record<string, string> = {
  stream_good: '配信映え',
  collab_good: 'コラボ向き',
  viewer_join: '視聴者参加',
  reaction_good: '初見リアク',
  loud_fun: '叫ぶ系',
  no_english: '英語不要',
  short_play: '短時間',
  easy_rule: 'ルール簡単',
  voice_chat_plus: '通話推奨',
  scale_up: '人数で化ける',
  solo_ok: 'ソロOK',
  slow_burn: 'じわ沼',
};

export async function GET(_req: Request, props: { params: Promise<{ universeId: string }> }) {
  const params = await props.params;
  const universeId = Number(params.universeId);
  if (!Number.isFinite(universeId) || universeId <= 0) {
    return new Response('invalid universeId', { status: 400 });
  }

  const supabase = createBrowserClient();

  // ゲーム基本情報
  const { data: game } = await supabase
    .from('games')
    .select('universe_id, name, name_ja, thumbnail_url, creator_name')
    .eq('universe_id', universeId)
    .maybeSingle();

  if (!game) {
    return new Response('game not found', { status: 404 });
  }

  // Roblox公式の日本ロケール名を優先（無ければ英語名）
  const displayName =
    (game as { name_ja: string | null }).name_ja ??
    (game as { name: string }).name;

  const meta = await fetchStreamingMeta(supabase, universeId).catch(() => null);

  // 配信向けバッジ抽出（meta 未設定でも得票タグから拾う）
  const { data: voteRows } = await supabase
    .from('game_tag_votes')
    .select('tag_id, vote_count, tag_master!inner(is_streaming_related)')
    .eq('universe_id', universeId)
    .eq('tag_master.is_streaming_related', true)
    .gt('vote_count', 0);
  const candidateTagIds = (voteRows ?? []).map(
    (r) => (r as { tag_id: string }).tag_id
  );
  const badges = pickBadges(candidateTagIds, 3);

  const pitch = meta?.shortPitchJa ?? displayName;
  const englishBarrier = meta?.englishBarrier ?? null;

  // 基本スタイルは system font のみ（edge runtime でフォント埋め込み省略）
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
          padding: '48px 56px',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif',
          justifyContent: 'space-between',
        }}
      >
        {/* ヘッダ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 22,
            opacity: 0.7,
          }}
        >
          <div>robro.jp — 配信ネタまとめ</div>
          {englishBarrier && (
            <div
              style={{
                display: 'flex',
                border: '2px solid #f5f5f5',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 22,
              }}
            >
              {englishBarrierLabel(englishBarrier)}
            </div>
          )}
        </div>

        {/* ゲーム名 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.35,
              opacity: 0.92,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {pitch}
          </div>
        </div>

        {/* バッジ + フッタ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {badges.map((id) => (
              <div
                key={id}
                style={{
                  display: 'flex',
                  backgroundColor: '#f5f5f5',
                  color: '#0b0b0b',
                  fontSize: 26,
                  padding: '8px 18px',
                  fontWeight: 600,
                }}
              >
                {BADGE_LABELS[id] ?? id}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 22, opacity: 0.65 }}>
            日本人向け Roblox 発見サイト
          </div>
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
