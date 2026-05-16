import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseEnv } from './supabase';

/**
 * 「みんなで作る日本ランキング」進捗ゲージのバックエンド集計
 *
 * 上位文書：CLAUDE.md「現在のフェーズ」、フェーズ8（3ボタン投票）
 *
 * 累計投票数（all ❤️ / ⭐ / 🔥 across all games）を取得し、
 * 段階制の現在 Tier（1000 → 10000 → 100000 → 1000000）と比較して進捗を返す。
 *
 * Tier の意義：
 *   - 開発初期：1000 票が見える達成目標 → ユーザーに「自分の1票で完成に近づく」感覚を与える
 *   - 段階達成のたびに新しい目標が現れる（ゲーミフィケーションの定石）
 *   - 最終 Tier 到達後は target=current として「完成 🎉」表示にする
 */

export const TIERS = [1000, 10000, 100000, 1000000] as const;

export interface BuildProgress {
  /** 累計投票数（ボタン3種合算、取消反映済み） */
  current: number;
  /** 現在 Tier の目標値 */
  target: number;
  /** 現在 Tier 番号（1〜TIERS.length。完走済みなら TIERS.length） */
  tier: number;
  /** 0〜1 の進捗比率（target に対する current の割合） */
  ratio: number;
  /** 全段階を達成済みか */
  completed: boolean;
}

/**
 * 累計投票数を取得（game_button_votes.vote_count の総和）
 *
 * game_button_votes は (universe_id, button_type) ごとの集計テーブルで、
 * トリガで即時更新される。マテビューより新鮮で軽量。
 */
export async function fetchTotalVotes(supabase: SupabaseClient): Promise<number> {
  if (!hasSupabaseEnv()) return 0;
  const { data, error } = await supabase
    .from('game_button_votes')
    .select('vote_count');
  if (error) {
    console.error('[build-progress] fetchTotalVotes error:', error);
    return 0;
  }
  const rows = (data ?? []) as Array<{ vote_count: number | null }>;
  return rows.reduce((s, r) => s + (r.vote_count ?? 0), 0);
}

/** current 値から現在 Tier 情報を導出 */
export function deriveProgress(current: number): BuildProgress {
  let tier = 1;
  for (const t of TIERS) {
    if (current < t) {
      return {
        current,
        target: t,
        tier,
        ratio: Math.min(1, current / t),
        completed: false,
      };
    }
    tier++;
  }
  // 全 Tier 突破
  const last = TIERS[TIERS.length - 1];
  return {
    current,
    target: last,
    tier: TIERS.length,
    ratio: 1,
    completed: true,
  };
}

export async function getBuildProgress(supabase: SupabaseClient): Promise<BuildProgress> {
  const current = await fetchTotalVotes(supabase);
  return deriveProgress(current);
}
