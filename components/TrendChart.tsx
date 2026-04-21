'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SnapshotPoint } from '@/lib/game-detail-query';

/**
 * 24時間CCU推移グラフ（Client Component）
 *
 * CLAUDE.md UI原則「装飾禁止」を踏襲：
 *  - 線1本、グリッドは淡いグレー、塗りつぶしなし
 *  - Tooltipは時刻とCCUだけ
 *  - モバイル最優先なのでアスペクト比は幅いっぱい × 高さ180px固定
 */

interface Props {
  data: SnapshotPoint[];
}

function formatHourLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function TrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-[13px] text-muted-foreground">
        データがまだ貯まっていません。
      </div>
    );
  }

  const chartData = data.map((p) => ({
    t: formatHourLabel(p.capturedAt),
    playing: p.playing,
  }));

  return (
    <div className="w-full h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={48}
            tickFormatter={(v) => new Intl.NumberFormat('ja-JP').format(v)}
          />
          <Tooltip
            formatter={(v) => [new Intl.NumberFormat('ja-JP').format(Number(v)), 'CCU']}
            labelFormatter={(l) => `時刻 ${l}`}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="playing"
            stroke="#2563eb"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
