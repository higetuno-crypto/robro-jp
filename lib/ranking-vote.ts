/**
 * フェーズ8：3ボタン投票のスコア計算（純粋関数）
 *
 * 上位文書：
 *   - higesakusei/idea-evaluation-v3.md §10
 *   - higesakusei/feature-spec.md §4
 *
 * 行動コスト＝情報価値の原理：
 *   ❤️ like      = 0.5（軽い反応）
 *   ⭐ save      = 1.0（標準シグナル）
 *   🔥 recommend = 2.1（最強シグナル、⭐2回分より誤差程度に重い）
 */

export type ButtonType = 'like' | 'save' | 'recommend';

export const BUTTON_WEIGHTS: Record<ButtonType, number> = {
  like: 0.5,
  save: 1.0,
  recommend: 2.1,
};

/** ベイズ平均パラメータ（IMDb方式：少数票の罠を回避） */
export const BAYESIAN_PARAMS: Record<ButtonType, { C: number; m: number }> = {
  like: { C: 50, m: 0.7 },
  save: { C: 30, m: 0.5 },
  recommend: { C: 30, m: 0.5 },
};

/** 時間減衰の半減期（日数） */
export const TIME_DECAY_HALF_LIFE_DAYS = 7;

/** 投票<このしきい値ならCCU合成、超えたら投票100% */
export const CCU_TRANSITION_THRESHOLD = 100;

/** ベイズ平均：少数票が極端に振れない */
export function bayesianScore(buttonType: ButtonType, voteCount: number): number {
  const { C, m } = BAYESIAN_PARAMS[buttonType];
  const safe = Math.max(0, voteCount);
  return (C * m + safe) / (C + safe);
}

/** 時間減衰係数（最終投票からの経過に応じて 1 → 0 に下がる） */
export function timeDecay(lastVotedAt: Date | string | null): number {
  if (!lastVotedAt) return 0;
  const t = typeof lastVotedAt === 'string' ? new Date(lastVotedAt) : lastVotedAt;
  const elapsedDays = (Date.now() - t.getTime()) / 86_400_000;
  if (elapsedDays < 0) return 1;
  return Math.exp(-elapsedDays / TIME_DECAY_HALF_LIFE_DAYS);
}

/** 重み付け合成スコア（時間減衰前） */
export function combinedVotingScore(scores: {
  like: number;
  save: number;
  recommend: number;
}): number {
  return (
    BUTTON_WEIGHTS.like * scores.like +
    BUTTON_WEIGHTS.save * scores.save +
    BUTTON_WEIGHTS.recommend * scores.recommend
  );
}

/**
 * 投票×CCU 合成（コールドスタート対策）
 *  - 投票<100：CCU比率高く
 *  - 投票>=100：投票100%
 */
export function displayedScore(args: {
  votingScore: number;
  ccuScore: number;
  totalVotes: number;
}): number {
  const alpha = Math.min(1, args.totalVotes / CCU_TRANSITION_THRESHOLD);
  return alpha * args.votingScore + (1 - alpha) * args.ccuScore;
}
