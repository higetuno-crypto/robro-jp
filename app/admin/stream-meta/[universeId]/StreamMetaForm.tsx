'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  StreamingMeta,
  FitLevel,
  EnglishBarrier,
  LearningCurve,
  StreamCautionNote,
} from '@/lib/streaming';

/**
 * 配信メタ編集フォーム（管理画面）。
 * 送信は PUT /api/admin/stream-meta/[universeId]。
 * サーバ側で validateStreamMeta + moderation が効く。
 */

interface FormState {
  shortPitchJa: string;
  streamSummaryJa: string;
  streamPoints: [string, string, string];
  soloFit: FitLevel;
  collabFit: FitLevel;
  viewerParticipationFit: FitLevel;
  clipFit: FitLevel;
  englishBarrier: EnglishBarrier;
  learningCurve: LearningCurve;
  first10minGuide: string;
  whyNowPopular: string;
  cautionNotes: StreamCautionNote[];
  recommendedPartySize: string;
  averageSessionLength: string;
  shareCardEnabled: boolean;
  editorialScoreStream: number;
}

function initialFrom(meta: StreamingMeta | null): FormState {
  return {
    shortPitchJa: meta?.shortPitchJa ?? '',
    streamSummaryJa: meta?.streamSummaryJa ?? '',
    streamPoints: [
      meta?.streamPoints[0] ?? '',
      meta?.streamPoints[1] ?? '',
      meta?.streamPoints[2] ?? '',
    ],
    soloFit: meta?.soloFit ?? 'mid',
    collabFit: meta?.collabFit ?? 'mid',
    viewerParticipationFit: meta?.viewerParticipationFit ?? 'mid',
    clipFit: meta?.clipFit ?? 'mid',
    englishBarrier: meta?.englishBarrier ?? 'mid',
    learningCurve: meta?.learningCurve ?? 'normal',
    first10minGuide: meta?.first10minGuide ?? '',
    whyNowPopular: meta?.whyNowPopular ?? '',
    cautionNotes: meta?.streamCautionNotes ?? [],
    recommendedPartySize: meta?.recommendedPartySize ?? '',
    averageSessionLength: meta?.averageSessionLength ?? '',
    shareCardEnabled: meta?.shareCardEnabled ?? true,
    editorialScoreStream: meta?.editorialScoreStream ?? 50,
  };
}

const LABEL = 'block text-[12px] text-muted-foreground mb-0.5';
const INPUT =
  'w-full border border-border bg-background px-2 py-1 text-[13px]';

export function StreamMetaForm({
  universeId,
  initial,
}: {
  universeId: number;
  initial: StreamingMeta | null;
}) {
  const router = useRouter();
  const [s, setS] = useState<FormState>(initialFrom(initial));
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'ok'; warnings: unknown[] }
    | { kind: 'err'; message: string; issues?: unknown }
  >({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'saving' });
    const body = {
      short_pitch_ja: s.shortPitchJa,
      stream_summary_ja: s.streamSummaryJa,
      stream_points: s.streamPoints.filter((p) => p.trim().length > 0),
      solo_fit: s.soloFit,
      collab_fit: s.collabFit,
      viewer_participation_fit: s.viewerParticipationFit,
      clip_fit: s.clipFit,
      english_barrier: s.englishBarrier,
      learning_curve: s.learningCurve,
      first_10min_guide: s.first10minGuide,
      why_now_popular: s.whyNowPopular,
      stream_caution_notes: s.cautionNotes,
      recommended_party_size: s.recommendedPartySize,
      average_session_length: s.averageSessionLength,
      share_card_enabled: s.shareCardEnabled,
      editorial_score_stream: s.editorialScoreStream,
    };
    try {
      const res = await fetch(`/api/admin/stream-meta/${universeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: 'err',
          message: (json as { error?: string }).error ?? `HTTP ${res.status}`,
          issues: (json as { issues?: unknown }).issues,
        });
        return;
      }
      setStatus({ kind: 'ok', warnings: (json as { warnings?: unknown[] }).warnings ?? [] });
      router.refresh();
    } catch (err) {
      setStatus({ kind: 'err', message: String(err) });
    }
  }

  async function onDelete() {
    if (!confirm('このゲームの配信メタを削除します。よろしいですか？')) return;
    setStatus({ kind: 'saving' });
    const res = await fetch(`/api/admin/stream-meta/${universeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setStatus({
        kind: 'err',
        message: (json as { error?: string }).error ?? `HTTP ${res.status}`,
      });
      return;
    }
    setS(initialFrom(null));
    setStatus({ kind: 'ok', warnings: [] });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={LABEL}>一言でいうと（5〜60字）</label>
        <input
          className={INPUT}
          value={s.shortPitchJa}
          onChange={(e) => setS({ ...s, shortPitchJa: e.target.value })}
          maxLength={60}
          required
        />
      </div>

      <div>
        <label className={LABEL}>サマリー（10〜200字）</label>
        <textarea
          className={INPUT + ' min-h-[80px]'}
          value={s.streamSummaryJa}
          onChange={(e) => setS({ ...s, streamSummaryJa: e.target.value })}
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className={LABEL}>配信で使いやすい理由（最大3件 / 各3〜40字）</label>
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              className={INPUT}
              value={s.streamPoints[i]}
              onChange={(e) => {
                const next = [...s.streamPoints] as [string, string, string];
                next[i] = e.target.value;
                setS({ ...s, streamPoints: next });
              }}
              maxLength={40}
              placeholder={`ポイント${i + 1}`}
            />
          ))}
        </div>
      </div>

      <fieldset className="grid grid-cols-2 gap-2">
        <Select
          label="ソロ相性"
          value={s.soloFit}
          onChange={(v) => setS({ ...s, soloFit: v as FitLevel })}
          options={['high', 'mid', 'low']}
        />
        <Select
          label="コラボ相性"
          value={s.collabFit}
          onChange={(v) => setS({ ...s, collabFit: v as FitLevel })}
          options={['high', 'mid', 'low']}
        />
        <Select
          label="視聴者参加"
          value={s.viewerParticipationFit}
          onChange={(v) =>
            setS({ ...s, viewerParticipationFit: v as FitLevel })
          }
          options={['high', 'mid', 'low']}
        />
        <Select
          label="切り抜き相性"
          value={s.clipFit}
          onChange={(v) => setS({ ...s, clipFit: v as FitLevel })}
          options={['high', 'mid', 'low']}
        />
        <Select
          label="英語依存度"
          value={s.englishBarrier}
          onChange={(v) =>
            setS({ ...s, englishBarrier: v as EnglishBarrier })
          }
          options={['low', 'mid', 'high']}
        />
        <Select
          label="学習コスト"
          value={s.learningCurve}
          onChange={(v) => setS({ ...s, learningCurve: v as LearningCurve })}
          options={['easy', 'normal', 'hard']}
        />
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>推奨人数（例: 2〜4人）</label>
          <input
            className={INPUT}
            value={s.recommendedPartySize}
            onChange={(e) =>
              setS({ ...s, recommendedPartySize: e.target.value })
            }
            maxLength={20}
          />
        </div>
        <div>
          <label className={LABEL}>1試合の長さ（例: 5〜10分）</label>
          <input
            className={INPUT}
            value={s.averageSessionLength}
            onChange={(e) =>
              setS({ ...s, averageSessionLength: e.target.value })
            }
            maxLength={30}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>最初の10分（300字以内）</label>
        <textarea
          className={INPUT + ' min-h-[60px]'}
          value={s.first10minGuide}
          onChange={(e) => setS({ ...s, first10minGuide: e.target.value })}
          maxLength={300}
        />
      </div>
      <div>
        <label className={LABEL}>今これが配信向きな理由（200字以内）</label>
        <textarea
          className={INPUT + ' min-h-[60px]'}
          value={s.whyNowPopular}
          onChange={(e) => setS({ ...s, whyNowPopular: e.target.value })}
          maxLength={200}
        />
      </div>

      <div>
        <label className={LABEL}>注意メモ（最大6件）</label>
        <div className="space-y-2">
          {s.cautionNotes.map((n, i) => (
            <div key={i} className="grid grid-cols-[80px_120px_1fr_72px] gap-1">
              <select
                className={INPUT}
                value={n.severity}
                onChange={(e) => {
                  const next = [...s.cautionNotes];
                  next[i] = { ...n, severity: e.target.value as 'info' | 'warn' };
                  setS({ ...s, cautionNotes: next });
                }}
              >
                <option value="info">info</option>
                <option value="warn">warn</option>
              </select>
              <input
                className={INPUT}
                value={n.label}
                onChange={(e) => {
                  const next = [...s.cautionNotes];
                  next[i] = { ...n, label: e.target.value };
                  setS({ ...s, cautionNotes: next });
                }}
                maxLength={20}
                placeholder="ラベル"
              />
              <input
                className={INPUT}
                value={n.body}
                onChange={(e) => {
                  const next = [...s.cautionNotes];
                  next[i] = { ...n, body: e.target.value };
                  setS({ ...s, cautionNotes: next });
                }}
                maxLength={120}
                placeholder="本文"
              />
              <button
                type="button"
                className="text-[12px] border border-border hover:bg-muted/40"
                onClick={() => {
                  setS({
                    ...s,
                    cautionNotes: s.cautionNotes.filter((_, idx) => idx !== i),
                  });
                }}
              >
                削除
              </button>
            </div>
          ))}
          {s.cautionNotes.length < 6 && (
            <button
              type="button"
              className="text-[12px] underline text-muted-foreground"
              onClick={() =>
                setS({
                  ...s,
                  cautionNotes: [
                    ...s.cautionNotes,
                    {
                      id: `n${Date.now()}`,
                      label: '',
                      body: '',
                      severity: 'info',
                    },
                  ],
                })
              }
            >
              ＋ 注意メモを追加
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-center">
        <div>
          <label className={LABEL}>編集スコア（0〜100）</label>
          <input
            className={INPUT}
            type="number"
            min={0}
            max={100}
            value={s.editorialScoreStream}
            onChange={(e) =>
              setS({
                ...s,
                editorialScoreStream: Number(e.target.value) || 0,
              })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] mt-4">
          <input
            type="checkbox"
            checked={s.shareCardEnabled}
            onChange={(e) =>
              setS({ ...s, shareCardEnabled: e.target.checked })
            }
          />
          シェアカードを表示する
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button
          type="submit"
          disabled={status.kind === 'saving'}
          className="px-3 py-1.5 text-[13px] bg-foreground text-background hover:opacity-90 disabled:opacity-50"
        >
          {status.kind === 'saving' ? '保存中…' : '保存'}
        </button>
        {initial && (
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-1.5 text-[13px] border border-red-500 text-red-600 hover:bg-red-50"
          >
            削除
          </button>
        )}
        {status.kind === 'ok' && (
          <span className="text-[12px] text-green-700">
            保存しました
            {(status.warnings ?? []).length > 0 && '（警告あり）'}
          </span>
        )}
        {status.kind === 'err' && (
          <span className="text-[12px] text-red-600">{status.message}</span>
        )}
      </div>
      {status.kind === 'err' && status.issues ? (
        <pre className="text-[11px] text-red-600 bg-red-50 p-2 overflow-auto">
          {JSON.stringify(status.issues, null, 2)}
        </pre>
      ) : null}
    </form>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <select
        className={INPUT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
