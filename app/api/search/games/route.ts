import { NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { searchRobloxGames, type RobloxSearchHit } from '@/lib/roblox-search';

/**
 * ハイブリッドゲーム検索 API
 *
 * GET /api/search/games?q=KEYWORD&limit=20
 *
 * 流れ：
 *  1. DB ILIKE で games.name / creator_name を引く（自サイト掲載分）
 *  2. Roblox 公式 API でも検索（全ゲーム対象）
 *  3. universe_id で deduplicate（DB 側を優先＝inDb:true ラベル付与）
 *  4. DB ヒットを上、外部結果を下にして返す
 *
 * 失敗ポリシー：Roblox API が落ちても DB 結果は返す（部分的な検索体験を維持）。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SearchHit {
  universeId: number;
  placeId: number | null;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  playing: number | null;
  inDb: boolean; // 自サイト掲載中なら true
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const rawLimit = Number(url.searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(Math.trunc(rawLimit), 50))
    : 20;

  if (!q || q.length < 1) {
    return NextResponse.json({ q, hits: [] satisfies SearchHit[] });
  }
  if (q.length > 100) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 });
  }

  const supabase = createBrowserClient();

  // ====== 1. DB 検索 ======
  // ILIKE で部分一致。playing 降順で上位 limit 件
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const dbPromise = supabase
    .from('games')
    .select(
      'universe_id, place_id, name, creator_name, thumbnail_url, is_japanese, game_snapshots(playing, captured_at)'
    )
    .or(`name.ilike.${pattern},creator_name.ilike.${pattern}`)
    .limit(limit);

  // ====== 2. Roblox API 検索（並列） ======
  const robloxPromise = searchRobloxGames(q, limit);

  const [dbRes, robloxHits] = await Promise.all([dbPromise, robloxPromise]);

  if (dbRes.error) {
    console.error('[api/search/games] db error:', dbRes.error);
  }

  // ====== 3. DB 行を SearchHit に変換 ======
  const dbHits: SearchHit[] = (dbRes.data ?? []).map((r) => {
    // game_snapshots は relation で配列で来るが、ここでは playing の最新値を取らずに
    // 最初の要素 or null。検索結果ページでは"参考CCU"程度の扱い。
    const snaps = (r.game_snapshots ?? []) as Array<{
      playing: number;
      captured_at: string;
    }>;
    const latestPlaying =
      snaps.length > 0
        ? snaps.sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0]
            .playing
        : null;
    return {
      universeId: r.universe_id,
      placeId: r.place_id,
      name: r.name,
      creatorName: r.creator_name,
      thumbnailUrl: r.thumbnail_url,
      playing: latestPlaying,
      inDb: true,
    };
  });

  // ====== 4. Roblox 結果を merge（DB 側にあるものは除外） ======
  const dbIds = new Set(dbHits.map((h) => h.universeId));
  const externalHits: SearchHit[] = robloxHits
    .filter((h: RobloxSearchHit) => !dbIds.has(h.universeId))
    .map((h) => ({
      universeId: h.universeId,
      placeId: h.placeId,
      name: h.name,
      creatorName: h.creatorName,
      thumbnailUrl: h.thumbnailUrl,
      playing: h.playing,
      inDb: false,
    }));

  // DB 内は playing 降順、外部は API の順（人気順）
  dbHits.sort((a, b) => (b.playing ?? 0) - (a.playing ?? 0));

  return NextResponse.json({
    q,
    hits: [...dbHits, ...externalHits].slice(0, limit * 2),
  });
}
