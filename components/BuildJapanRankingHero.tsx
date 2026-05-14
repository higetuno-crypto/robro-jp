import type { BuildProgress } from '@/lib/build-progress';
import { BuildHeroSearch } from './BuildHeroSearch';

/**
 * トップ `/` の主役ヒーロー：「みんなで作る日本ランキング」
 *
 * 上位文書：CLAUDE.md 北極星「優秀なクリエイターが真っ当に評価される」
 * 設計判断：is_japanese 推定だけではランキングが立ち上がらないため、
 *   ユーザーの能動的な「推し登録（投票）」を入口に据える。
 *
 * 構成：
 *   1. タイトル + 一言コピー
 *   2. 進捗ゲージ（累計投票数 / 現 Tier 目標、ratio バー）
 *   3. 検索 + 投票UI（Client Component に委譲）
 *
 * UI トーン：
 *   ランキング行（A群）の淡々ルールは適用外。WelcomeStrip や Featured と同じく
 *   ヒーロー扱いだが、装飾は最小限（border + muted text）。
 */
export function BuildJapanRankingHero({
  progress,
}: {
  progress: BuildProgress;
}) {
  const pct = Math.round(progress.ratio * 100);

  return (
    <section className="border-b border-border px-3 py-4">
      <h1 className="text-[15px] font-semibold leading-tight">
        みんなで作る日本ランキング
      </h1>
      <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
        あなたの「推し」への一票で、日本ユーザー向けランキングが立ち上がります。
      </p>

      {/* 進捗ゲージ */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[12px] tabular-nums">
          {progress.completed ? (
            <span className="font-medium">完成 🎉 累計 {progress.current.toLocaleString('ja-JP')} 票</span>
          ) : (
            <>
              <span>
                <span className="font-medium">{progress.current.toLocaleString('ja-JP')}</span>
                <span className="text-muted-foreground"> / {progress.target.toLocaleString('ja-JP')} 票</span>
              </span>
              <span className="text-muted-foreground">Tier {progress.tier}</span>
            </>
          )}
        </div>
        <div
          className="mt-1 h-1.5 w-full bg-muted overflow-hidden rounded-sm"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-foreground transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 推し検索 + 投票 */}
      <div className="mt-4">
        <BuildHeroSearch />
      </div>
    </section>
  );
}
