import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { fetchTopUniverseIds } from '@/lib/roblox-explore-api';
import { fetchGameDetails } from '@/lib/roblox-api';
import { detectJapanese } from '@/lib/japanese-detector';

/**
 * Vercel Cron から叩かれるデータ取得エンドポイント
 *
 * 流れ：
 *   1. Rolimons で上位500件のUniverseIdを取得
 *   2. Roblox公式APIで詳細＋サムネをバッチ取得
 *   3. games を upsert（マスタ更新）
 *   4. game_snapshots を insert（時系列に追記）
 *
 * 認証：Authorization: Bearer <CRON_SECRET>
 *
 * 実行間隔：10分（vercel.json の cron schedule で指定）
 */

// Node runtime（Edgeだと時間制限厳しいので通常のLambdaで回す）
export const runtime = 'nodejs';
// Cronは動的実行なのでキャッシュ無効
export const dynamic = 'force-dynamic';
// 最大60秒（Vercel Hobby枠）に収まる範囲で実行
export const maxDuration = 60;

const FETCH_LIMIT = 500;

export async function GET(request: Request) {
  // ====== 認証 ======
  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // ====== 1. Rolimons から UniverseId リスト取得 ======
    const universeIds = await fetchTopUniverseIds(FETCH_LIMIT);
    if (universeIds.length === 0) {
      return NextResponse.json({ error: 'no ids from explore-api' }, { status: 502 });
    }

    // ====== 2. Roblox 公式 API で詳細＋サムネ ======
    const games = await fetchGameDetails(universeIds);
    if (games.length === 0) {
      return NextResponse.json({ error: 'no games from roblox' }, { status: 502 });
    }

    // ====== 3. games upsert ＋ 4. snapshot insert 用レコード構築 ======
    const capturedAt = new Date().toISOString();

    const gameRows = games.map((g) => {
      const j = detectJapanese(g.name, g.description);
      return {
        universe_id: g.id,
        place_id: g.rootPlaceId,
        name: g.name,
        description: g.description,
        creator_name: g.creator?.name ?? null,
        creator_type: g.creator?.type ?? null,
        thumbnail_url: g.thumbnailUrl,
        is_japanese: j.isJapanese,
        japanese_score: j.score,
        updated_at: capturedAt,
      };
    });

    const snapshotRows = games.map((g) => ({
      universe_id: g.id,
      captured_at: capturedAt,
      playing: g.playing,
      visits: g.visits,
      favorites: g.favoritedCount,
    }));

    // ====== Supabase へ書き込み ======
    const supabase = createServiceClient();

    // games は universe_id をキーに upsert（既存なら updated_at 等を上書き）
    const { error: upsertErr } = await supabase
      .from('games')
      .upsert(gameRows, { onConflict: 'universe_id' });
    if (upsertErr) throw upsertErr;

    // game_snapshots は (universe_id, captured_at) 複合PKに insert
    const { error: insertErr } = await supabase
      .from('game_snapshots')
      .insert(snapshotRows);
    if (insertErr) throw insertErr;

    return NextResponse.json({
      ok: true,
      fetched: games.length,
      japanese: gameRows.filter((r) => r.is_japanese).length,
      elapsedMs: Date.now() - startedAt,
      capturedAt,
    });
  } catch (err) {
    console.error('[cron fetch-games] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
