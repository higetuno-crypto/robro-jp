import type { FitLevel } from '@/lib/streaming';

/**
 * 配信形式との相性：4行のドットメーター。
 * color のみでなくテキストも併記（a11y）。
 */

function Dots({ level, label }: { level: FitLevel; label: string }) {
  const filled = level === 'high' ? 3 : level === 'mid' ? 2 : 1;
  return (
    <div
      className="grid grid-cols-[80px_56px_auto] items-center gap-2 text-[13px]"
      aria-label={`${label}: ${level}`}
    >
      <div className="text-muted-foreground">{label}</div>
      <div className="flex gap-1 tabular-nums" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full border border-foreground ${
              i < filled ? 'bg-foreground' : ''
            }`}
          />
        ))}
      </div>
      <div className="text-[12px] text-muted-foreground">
        {level === 'high' ? '高' : level === 'mid' ? '中' : '低'}
      </div>
    </div>
  );
}

export function StreamFitMatrix({
  soloFit,
  collabFit,
  viewerParticipationFit,
  clipFit,
}: {
  soloFit: FitLevel;
  collabFit: FitLevel;
  viewerParticipationFit: FitLevel;
  clipFit: FitLevel;
}) {
  return (
    <div className="space-y-1.5">
      <Dots level={soloFit} label="ソロ" />
      <Dots level={collabFit} label="コラボ" />
      <Dots level={viewerParticipationFit} label="視聴者参加" />
      <Dots level={clipFit} label="切り抜き" />
    </div>
  );
}
