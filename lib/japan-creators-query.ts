import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankingRowData } from '@/types/game';
import { hasSupabaseEnv } from '@/lib/supabase';

/**
 * 「日本制作」発見ページ用クエリ（Server Component 専用）
 *
 * 狙い：本物の日本人クリエイターが作ったゲームだけを発見させる。
 *
 * 重要な設計判断（データ検証で確定）：
 * - name_ja（Roblox の ja-jp ロケール名）は **自動翻訳**を含むため判定に使わない。
 *   「Brookhaven → ブルックヘイブン」のようなグローバル人気の機械翻訳が混ざり、
 *   実質 /global の日本語版になってしまう。
 * - 本物の日本制作を見分けるシグナルは
 *   「**ベース名 name** もしくは **制作者名 creator_name** に日本語（かな/漢字）を含む」。
 *   自動翻訳ゲームはベース名も制作者名も英語なので自然に除外される。
 *
 * 既存ランキング（lib/ranking-query.ts）はスナップショット起点のため、CCU の無い
 * 手動追加ゲーム（検索で拾えず後から登録したもの）が出ない。このページは
 * **games テーブル起点**にして、最新スナップショットの CCU は「あれば添える / 無ければ null」。
 *
 * 並び順：「にぎわい優先ハイブリッド」
 *   1. 現在CCUが分かるゲーム（実際に遊ばれている）を上に、playing 降順
 *   2. CCU不明のゲームはその下に first_seen_at 降順（新着順）
 *   → 純粋なCCUランキングではなく「発見リスト」。順位を競わせない正直な並び。
 *
 * 既知の限界：漢字のみの制作者名は稀に中国語クリエイターを拾う可能性がある
 * （現状は実害なし。母数が増えたら精緻化）。
 */

// ひらがな・カタカナ・CJK統合漢字・半角カタカナ
const JP_CHAR_REGEX = /[぀-ゟ゠-ヿ一-鿿ｦ-ﾟ]/;

/** 新着バッジを付ける期間（日数）。これ以内に first_seen したものは NEW 扱い */
const NEW_WITHIN_DAYS = 7;

/** Supabase の1回の select 上限（PostgREST デフォルト1000）。ページングで全件取る */
const PAGE_SIZE = 1000;

interface GameRow {
  universe_id: number;
  name: string;
  name_ja: string | null;
  creator_name: string | null;
  thumbnail_url: string | null;
  first_seen_at: string | null;
}

export function containsJapanese(s: string | null | undefined): boolean {
  if (!s) return false;
  return JP_CHAR_REGEX.test(s);
}

/** games を全件ページングで取得（1037件規模なので2〜数ページで完了） */
async function fetchAllGames(supabase: SupabaseClient): Promise<GameRow[]> {
  const out: GameRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('games')
      .select('universe_id, name, name_ja, creator_name, thumbnail_url, first_seen_at')
      .order('universe_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as GameRow[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** 最新 captured_at を取得（無ければ null） */
async function fetchLatestCapturedAt(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('game_snapshots')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.captured_at ?? null;
}

/** 指定 universe_id 群について、最新 captured_at の playing を引く */
async function fetchLatestPlaying(
  supabase: SupabaseClient,
  capturedAt: string,
  universeIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (universeIds.length === 0) return map;
  // .in() のサイズ上限を避けてチャンク化
  const CHUNK = 300;
  for (let i = 0; i < universeIds.length; i += CHUNK) {
    const ids = universeIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('game_snapshots')
      .select('universe_id, playing')
      .eq('captured_at', capturedAt)
      .in('universe_id', ids);
    if (error) throw error;
    for (const s of (data ?? []) as { universe_id: number; playing: number }[]) {
      map.set(s.universe_id, s.playing);
    }
  }
  return map;
}

export interface JapanCreatorsResult {
  rows: RankingRowData[];
  /** CCU 表示の基準時刻（最新スナップショット）。無ければ null */
  capturedAt: string | null;
  /** シグナル該当の総数（limit 前） */
  total: number;
}

/**
 * 日本制作ゲームを「にぎわい優先ハイブリッド」順で返す。
 */
export async function getJapaneseCreatorGames(
  supabase: SupabaseClient,
  limit = 100,
  now: Date = new Date()
): Promise<JapanCreatorsResult> {
  if (!hasSupabaseEnv()) return { rows: [], capturedAt: null, total: 0 };

  const [allGames, capturedAt] = await Promise.all([
    fetchAllGames(supabase),
    fetchLatestCapturedAt(supabase),
  ]);

  // シグナル：ベース名 or 制作者名に日本語
  const matched = allGames.filter(
    (g) => containsJapanese(g.name) || containsJapanese(g.creator_name)
  );

  const playingMap = capturedAt
    ? await fetchLatestPlaying(
        supabase,
        capturedAt,
        matched.map((g) => g.universe_id)
      )
    : new Map<number, number>();

  // にぎわい優先ハイブリッド：
  //  active（CCU既知）を playing 降順、rest（CCU不明）を first_seen 降順、active を上に
  const active: GameRow[] = [];
  const rest: GameRow[] = [];
  for (const g of matched) {
    if (playingMap.has(g.universe_id)) active.push(g);
    else rest.push(g);
  }
  active.sort(
    (a, b) => (playingMap.get(b.universe_id) ?? 0) - (playingMap.get(a.universe_id) ?? 0)
  );
  const firstSeenMs = (g: GameRow) =>
    g.first_seen_at ? new Date(g.first_seen_at).getTime() : 0;
  rest.sort((a, b) => firstSeenMs(b) - firstSeenMs(a));

  const ordered = [...active, ...rest].slice(0, limit);

  const newCutoffMs = now.getTime() - NEW_WITHIN_DAYS * 24 * 60 * 60 * 1000;

  const rows: RankingRowData[] = ordered.map((g, i) => {
    const playing = playingMap.has(g.universe_id)
      ? (playingMap.get(g.universe_id) as number)
      : null;
    const isNew = firstSeenMs(g) >= newCutoffMs;
    return {
      universeId: g.universe_id,
      rank: i + 1,
      name: g.name_ja ?? g.name,
      creatorName: g.creator_name,
      thumbnailUrl: g.thumbnail_url,
      playing,
      // 変動列を「発見ページ」用に転用：最近追加なら NEW(青)、それ以外は無印(―)
      rankDelta: isNew ? null : 0,
      isJapanese: true,
    };
  });

  return { rows, capturedAt, total: matched.length };
}
