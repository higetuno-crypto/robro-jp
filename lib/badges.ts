import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * フェーズ11：バッジ管理
 *
 * 設計：
 *  - account_badges テーブルに (account_id, badge_key) で1行ずつ
 *  - 進行型バッジ（tag_artisan）は meta.tier で段階を表現（10票ごとに +1）
 *  - 累積型バッジ（first_tagger）は meta.games でゲーム数を保持
 *  - 一度きりバッジ（early_access）は meta.signed_up_at のみ
 */

export type BadgeKey = 'tag_artisan' | 'first_tagger' | 'early_access';

export interface BadgeDefinition {
  key: BadgeKey;
  emoji: string;
  name: string;
  description: string;
}

export const BADGE_DEFS: Record<BadgeKey, BadgeDefinition> = {
  tag_artisan: {
    key: 'tag_artisan',
    emoji: '🏷️',
    name: 'タグ職人',
    description: '10票ごとにランクアップ。投票で集合知を育てた人',
  },
  first_tagger: {
    key: 'first_tagger',
    emoji: '🥇',
    name: '最初の発見者',
    description: 'まだ誰もタグを付けていなかったゲームに最初の1票を入れた',
  },
  early_access: {
    key: 'early_access',
    emoji: '🌱',
    name: '早期アクセス',
    description: '2026-11-30 までに登録してくれた立ち上げ期のメンバー',
  },
};

export const EARLY_ACCESS_DEADLINE = '2026-11-30T23:59:59+09:00';

export interface BadgeRow {
  accountId: string;
  badgeKey: BadgeKey;
  earnedAt: string;
  meta: Record<string, unknown>;
}

/** 単一アカウントのバッジ一覧を取得 */
export async function fetchAccountBadges(
  supabase: SupabaseClient,
  accountId: string
): Promise<BadgeRow[]> {
  const { data, error } = await supabase
    .from('account_badges')
    .select('account_id, badge_key, earned_at, meta')
    .eq('account_id', accountId)
    .order('earned_at', { ascending: true });
  if (error) {
    console.error('[fetchAccountBadges]', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    accountId: r.account_id,
    badgeKey: r.badge_key as BadgeKey,
    earnedAt: r.earned_at,
    meta: (r.meta ?? {}) as Record<string, unknown>,
  }));
}

/** tag_artisan の tier 計算：10票ごとに +1（v1 はキャップなし） */
export function calcTagArtisanTier(voteCount: number): number {
  if (voteCount < 10) return 0;
  return Math.floor(voteCount / 10);
}

/**
 * first_tagger 判定＆付与（1リクエスト = 1ゲームごとに1回だけ呼ぶ）
 *
 * 判定：投票後の game_tag_vote_logs に、自分以外の account_id が含まれるか？
 *  - 自分しかいなければ「自分がこのゲームの最初のタグ付与者」
 *  - meta.universe_ids[] でカウント済ゲームを記録し、二重計上を防ぐ
 *
 * 注意：service role の supabase を渡すこと。
 */
export async function maybeAwardFirstTagger(
  supabase: SupabaseClient,
  accountId: string,
  universeId: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from('game_tag_vote_logs')
    .select('account_id')
    .eq('universe_id', universeId)
    .not('account_id', 'is', null);
  if (error) {
    console.error('[maybeAwardFirstTagger] select error:', error);
    return false;
  }
  const distinct = new Set<string>();
  for (const r of data ?? []) {
    if (r.account_id) distinct.add(r.account_id as string);
  }
  // 自分以外が居る、または自分が居ない（あり得ないが念のため）→ 対象外
  if (distinct.size !== 1 || !distinct.has(accountId)) return false;

  // 既存バッジを取得（meta.universe_ids で重複付与をブロック）
  const { data: existing } = await supabase
    .from('account_badges')
    .select('meta')
    .eq('account_id', accountId)
    .eq('badge_key', 'first_tagger')
    .maybeSingle();

  const meta = (existing?.meta ?? {}) as Record<string, unknown>;
  const prevIds = Array.isArray(meta.universe_ids)
    ? (meta.universe_ids as number[])
    : [];
  if (prevIds.includes(universeId)) return false; // 既に計上済

  const newIds = [...prevIds, universeId];
  const { error: upErr } = await supabase.from('account_badges').upsert(
    {
      account_id: accountId,
      badge_key: 'first_tagger',
      meta: { games: newIds.length, universe_ids: newIds },
    },
    { onConflict: 'account_id,badge_key' }
  );
  if (upErr) {
    console.error('[maybeAwardFirstTagger] upsert error:', upErr);
    return false;
  }
  return true;
}

/** バッジ表示用ラベル（tier 表記など） */
export function badgeDisplayLabel(row: BadgeRow): string {
  const def = BADGE_DEFS[row.badgeKey];
  if (!def) return '';
  if (row.badgeKey === 'tag_artisan') {
    const tier = (row.meta.tier as number | undefined) ?? 1;
    return `${def.emoji} ${def.name} Tier ${tier}`;
  }
  if (row.badgeKey === 'first_tagger') {
    const games = (row.meta.games as number | undefined) ?? 1;
    return `${def.emoji} ${def.name}（${games}ゲーム）`;
  }
  return `${def.emoji} ${def.name}`;
}
