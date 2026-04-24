import type { StreamingMeta } from '@/lib/streaming';
import { englishBarrierLabel } from '@/lib/streaming';
import { StreamFitMatrix } from './StreamFitMatrix';
import { StreamCautionList } from './StreamCautionList';
import { FirstTenMinutesBox, WhyNowPopularBox } from './FirstTenMinutesBox';
import { ShareCardButton } from './ShareCardButton';

/**
 * ゲーム詳細ページに埋め込む「配信者向け情報」パネル。
 * stream-meta が存在するゲームだけ呼び出される前提。
 */
export function StreamMetaPanel({
  meta,
  gameName,
}: {
  meta: StreamingMeta;
  gameName: string;
}) {
  return (
    <section className="mt-6 border-t border-border pt-4" data-testid="stream-meta-panel">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[14px] font-semibold">配信者向け情報</h2>
        <span className="text-[11px] text-muted-foreground">
          編集スコア {meta.editorialScoreStream} / 100
        </span>
      </div>

      {/* 一言ピッチ */}
      <div className="mb-3">
        <div className="text-[12px] text-muted-foreground mb-0.5">一言でいうと</div>
        <p className="text-[14px] leading-relaxed">{meta.shortPitchJa}</p>
      </div>

      {meta.streamSummaryJa && (
        <div className="mb-3">
          <div className="text-[12px] text-muted-foreground mb-0.5">サマリー</div>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {meta.streamSummaryJa}
          </p>
        </div>
      )}

      {/* ポイント3つ */}
      {meta.streamPoints.length > 0 && (
        <div className="mb-3">
          <div className="text-[12px] text-muted-foreground mb-1">配信で使いやすい理由</div>
          <ul className="space-y-1 text-[13px]">
            {meta.streamPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FitMatrix */}
      <div className="mb-3">
        <div className="text-[12px] text-muted-foreground mb-1">配信形式との相性</div>
        <StreamFitMatrix
          soloFit={meta.soloFit}
          collabFit={meta.collabFit}
          viewerParticipationFit={meta.viewerParticipationFit}
          clipFit={meta.clipFit}
        />
      </div>

      {/* メタ情報（英語ハードル / 学習コスト / 人数 / 所要） */}
      <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">英語依存度</span>
          <span>{englishBarrierLabel(meta.englishBarrier).replace('英語ハードル ', '')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">学習コスト</span>
          <span>
            {meta.learningCurve === 'easy' ? '低' : meta.learningCurve === 'normal' ? '中' : '高'}
          </span>
        </div>
        {meta.recommendedPartySize && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">推奨人数</span>
            <span>{meta.recommendedPartySize}</span>
          </div>
        )}
        {meta.averageSessionLength && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">1試合の長さ</span>
            <span>{meta.averageSessionLength}</span>
          </div>
        )}
      </div>

      <FirstTenMinutesBox text={meta.first10minGuide} />
      {meta.first10minGuide && meta.whyNowPopular ? <div className="h-2" /> : null}
      <WhyNowPopularBox text={meta.whyNowPopular} />

      {/* 注意メモ */}
      {meta.streamCautionNotes.length > 0 && (
        <div className="mt-3">
          <div className="text-[12px] text-muted-foreground mb-1">配信前に見ておきたい注意点</div>
          <StreamCautionList notes={meta.streamCautionNotes} />
        </div>
      )}

      {meta.shareCardEnabled && (
        <div className="mt-4">
          <ShareCardButton
            universeId={meta.universeId}
            gameName={gameName}
            shortPitch={meta.shortPitchJa}
          />
        </div>
      )}
    </section>
  );
}
