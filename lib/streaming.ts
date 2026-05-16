import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseEnv } from './supabase';

/**
 * フェーズ7：配信者導線ヘルパー
 *
 * - 型定義 / Supabase 取得 / slot→tag解決 / バリデーション / 文言チェック
 * - CLAUDE.md のフェーズ7スキーマに準拠
 */

export type FitLevel = 'high' | 'mid' | 'low';
export type EnglishBarrier = 'low' | 'mid' | 'high';
export type LearningCurve = 'easy' | 'normal' | 'hard';
export type CautionSeverity = 'info' | 'warn';

export interface StreamCautionNote {
  id: string;
  label: string;
  body: string;
  severity: CautionSeverity;
}

export interface StreamingMeta {
  universeId: number;
  shortPitchJa: string;
  streamSummaryJa: string;
  streamPoints: string[];
  soloFit: FitLevel;
  collabFit: FitLevel;
  viewerParticipationFit: FitLevel;
  clipFit: FitLevel;
  englishBarrier: EnglishBarrier;
  learningCurve: LearningCurve;
  first10minGuide: string;
  whyNowPopular: string;
  streamCautionNotes: StreamCautionNote[];
  recommendedPartySize: string;
  averageSessionLength: string;
  shareCardEnabled: boolean;
  editorialScoreStream: number;
  updatedAt: string;
}

export interface StreamSlot {
  slotKey: string;
  displayName: string;
  description: string;
  sortOrder: number;
  tagIds: string[];
}

/** 配信向けバッジ表示の優先度（最大3件まで表示する際の並び） */
export const BADGE_PRIORITY: readonly string[] = [
  'stream_good',
  'collab_good',
  'viewer_join',
  'reaction_good',
  'loud_fun',
  'no_english',
  'short_play',
  'easy_rule',
  'voice_chat_plus',
  'scale_up',
  'solo_ok',
  'slow_burn',
];

export const FIT_LEVELS: readonly FitLevel[] = ['high', 'mid', 'low'];
export const ENGLISH_BARRIERS: readonly EnglishBarrier[] = ['low', 'mid', 'high'];
export const LEARNING_CURVES: readonly LearningCurve[] = ['easy', 'normal', 'hard'];
export const CAUTION_SEVERITIES: readonly CautionSeverity[] = ['info', 'warn'];

// ============ Supabase 取得 ============

type GsmRow = {
  universe_id: number;
  short_pitch_ja: string;
  stream_summary_ja: string;
  stream_points: unknown;
  solo_fit: FitLevel;
  collab_fit: FitLevel;
  viewer_participation_fit: FitLevel;
  clip_fit: FitLevel;
  english_barrier: EnglishBarrier;
  learning_curve: LearningCurve;
  first_10min_guide: string;
  why_now_popular: string;
  stream_caution_notes: unknown;
  recommended_party_size: string;
  average_session_length: string;
  share_card_enabled: boolean;
  editorial_score_stream: number;
  updated_at: string;
};

function mapGsm(r: GsmRow): StreamingMeta {
  return {
    universeId: r.universe_id,
    shortPitchJa: r.short_pitch_ja,
    streamSummaryJa: r.stream_summary_ja,
    streamPoints: Array.isArray(r.stream_points)
      ? (r.stream_points as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    soloFit: r.solo_fit,
    collabFit: r.collab_fit,
    viewerParticipationFit: r.viewer_participation_fit,
    clipFit: r.clip_fit,
    englishBarrier: r.english_barrier,
    learningCurve: r.learning_curve,
    first10minGuide: r.first_10min_guide,
    whyNowPopular: r.why_now_popular,
    streamCautionNotes: normalizeCautionNotes(r.stream_caution_notes),
    recommendedPartySize: r.recommended_party_size,
    averageSessionLength: r.average_session_length,
    shareCardEnabled: r.share_card_enabled,
    editorialScoreStream: r.editorial_score_stream,
    updatedAt: r.updated_at,
  };
}

function normalizeCautionNotes(input: unknown): StreamCautionNote[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    .map((v): StreamCautionNote => ({
      id: String(v.id ?? ''),
      label: String(v.label ?? ''),
      body: String(v.body ?? ''),
      severity: v.severity === 'warn' ? 'warn' : 'info',
    }))
    .filter((n) => n.label.length > 0 && n.body.length > 0);
}

export async function fetchStreamingMeta(
  supabase: SupabaseClient,
  universeId: number
): Promise<StreamingMeta | null> {
  if (!hasSupabaseEnv()) return null;
  const { data, error } = await supabase
    .from('game_streaming_meta')
    .select('*')
    .eq('universe_id', universeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapGsm(data as GsmRow);
}

export async function fetchAllSlots(
  supabase: SupabaseClient
): Promise<StreamSlot[]> {
  if (!hasSupabaseEnv()) return [];
  const { data: slots, error } = await supabase
    .from('stream_slots')
    .select('slot_key, display_name, description, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const { data: maps, error: mErr } = await supabase
    .from('stream_slot_tags')
    .select('slot_key, tag_id');
  if (mErr) throw mErr;

  const tagMap = new Map<string, string[]>();
  for (const row of (maps ?? []) as { slot_key: string; tag_id: string }[]) {
    const cur = tagMap.get(row.slot_key) ?? [];
    cur.push(row.tag_id);
    tagMap.set(row.slot_key, cur);
  }

  return ((slots ?? []) as Array<{
    slot_key: string;
    display_name: string;
    description: string;
    sort_order: number;
  }>).map((s) => ({
    slotKey: s.slot_key,
    displayName: s.display_name,
    description: s.description,
    sortOrder: s.sort_order,
    tagIds: tagMap.get(s.slot_key) ?? [],
  }));
}

export async function fetchSlotBySlug(
  supabase: SupabaseClient,
  slotKey: string
): Promise<StreamSlot | null> {
  if (!hasSupabaseEnv()) return null;
  const { data: slot, error } = await supabase
    .from('stream_slots')
    .select('slot_key, display_name, description, sort_order')
    .eq('slot_key', slotKey)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!slot) return null;

  const { data: maps, error: mErr } = await supabase
    .from('stream_slot_tags')
    .select('tag_id')
    .eq('slot_key', slotKey);
  if (mErr) throw mErr;

  return {
    slotKey: slot.slot_key,
    displayName: slot.display_name,
    description: slot.description,
    sortOrder: slot.sort_order,
    tagIds: (maps ?? []).map((m) => (m as { tag_id: string }).tag_id),
  };
}

/** スロット一覧用：各 slotKey に該当するゲーム件数（confidence>0） */
export async function fetchSlotGameCounts(
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  if (!hasSupabaseEnv()) return new Map();
  const { data: maps, error } = await supabase
    .from('stream_slot_tags')
    .select('slot_key, tag_id');
  if (error) throw error;

  const tagsBySlot = new Map<string, string[]>();
  const allTagIds = new Set<string>();
  for (const r of (maps ?? []) as { slot_key: string; tag_id: string }[]) {
    const cur = tagsBySlot.get(r.slot_key) ?? [];
    cur.push(r.tag_id);
    tagsBySlot.set(r.slot_key, cur);
    allTagIds.add(r.tag_id);
  }

  if (allTagIds.size === 0) return new Map();

  const { data: votes, error: vErr } = await supabase
    .from('game_tag_votes')
    .select('universe_id, tag_id')
    .in('tag_id', Array.from(allTagIds))
    .gt('vote_count', 0);
  if (vErr) throw vErr;

  const gamesByTag = new Map<string, Set<number>>();
  for (const v of (votes ?? []) as { universe_id: number; tag_id: string }[]) {
    const s = gamesByTag.get(v.tag_id) ?? new Set<number>();
    s.add(v.universe_id);
    gamesByTag.set(v.tag_id, s);
  }

  const out = new Map<string, number>();
  tagsBySlot.forEach((tagIds, slotKey) => {
    const union = new Set<number>();
    for (const t of tagIds) {
      const s = gamesByTag.get(t);
      if (s) s.forEach((u) => union.add(u));
    }
    out.set(slotKey, union.size);
  });
  return out;
}

/** スロット詳細用：該当タグを持つゲーム一覧（confidence / editorial / voteCount 順） */
export interface SlotGameRow {
  universeId: number;
  name: string;
  creatorName: string | null;
  thumbnailUrl: string | null;
  shortPitchJa: string | null;
  englishBarrier: EnglishBarrier | null;
  editorialScoreStream: number;
  bestConfidence: number;
  totalVoteCount: number;
  badges: string[];
}

export async function fetchGamesForSlot(
  supabase: SupabaseClient,
  slotKey: string,
  limit = 30
): Promise<SlotGameRow[]> {
  if (!hasSupabaseEnv()) return [];
  const slot = await fetchSlotBySlug(supabase, slotKey);
  if (!slot || slot.tagIds.length === 0) return [];

  const { data: votes, error: vErr } = await supabase
    .from('game_tag_votes')
    .select('universe_id, tag_id, vote_count, confidence_score')
    .in('tag_id', slot.tagIds)
    .gt('vote_count', 0);
  if (vErr) throw vErr;

  type VoteRow = {
    universe_id: number;
    tag_id: string;
    vote_count: number;
    confidence_score: number;
  };
  const rows = (votes ?? []) as VoteRow[];
  if (rows.length === 0) return [];

  // ゲーム別に集計：best confidence, total votes, tag_ids
  type Agg = {
    bestConfidence: number;
    totalVoteCount: number;
    tagIds: Set<string>;
  };
  const byGame = new Map<number, Agg>();
  for (const r of rows) {
    const a = byGame.get(r.universe_id) ?? {
      bestConfidence: 0,
      totalVoteCount: 0,
      tagIds: new Set<string>(),
    };
    a.bestConfidence = Math.max(a.bestConfidence, r.confidence_score);
    a.totalVoteCount += r.vote_count;
    a.tagIds.add(r.tag_id);
    byGame.set(r.universe_id, a);
  }

  const universeIds = Array.from(byGame.keys());

  const [gamesRes, metaRes, allBadgesRes] = await Promise.all([
    supabase
      .from('games')
      .select('universe_id, name, creator_name, thumbnail_url')
      .in('universe_id', universeIds),
    supabase
      .from('game_streaming_meta')
      .select('universe_id, short_pitch_ja, english_barrier, editorial_score_stream')
      .in('universe_id', universeIds),
    // 配信向けバッジ抽出用：各ゲームが得ているストリーミング関連タグ
    supabase
      .from('game_tag_votes')
      .select('universe_id, tag_id, vote_count, tag_master!inner(is_streaming_related)')
      .in('universe_id', universeIds)
      .eq('tag_master.is_streaming_related', true)
      .gt('vote_count', 0),
  ]);
  if (gamesRes.error) throw gamesRes.error;
  if (metaRes.error) throw metaRes.error;
  if (allBadgesRes.error) throw allBadgesRes.error;

  const gameMap = new Map(
    ((gamesRes.data ?? []) as Array<{
      universe_id: number;
      name: string;
      creator_name: string | null;
      thumbnail_url: string | null;
    }>).map((g) => [g.universe_id, g])
  );
  const metaMap = new Map(
    ((metaRes.data ?? []) as Array<{
      universe_id: number;
      short_pitch_ja: string;
      english_barrier: EnglishBarrier;
      editorial_score_stream: number;
    }>).map((m) => [m.universe_id, m])
  );
  const badgeMap = new Map<number, Set<string>>();
  for (const b of (allBadgesRes.data ?? []) as Array<{
    universe_id: number;
    tag_id: string;
  }>) {
    const s = badgeMap.get(b.universe_id) ?? new Set<string>();
    s.add(b.tag_id);
    badgeMap.set(b.universe_id, s);
  }

  const result: SlotGameRow[] = [];
  byGame.forEach((agg, universeId) => {
    const g = gameMap.get(universeId);
    if (!g) return;
    const m = metaMap.get(universeId) ?? null;
    const candidateBadges = badgeMap.get(universeId) ?? new Set<string>();
    const badges = pickBadges(candidateBadges, 3);
    result.push({
      universeId,
      name: g.name,
      creatorName: g.creator_name,
      thumbnailUrl: g.thumbnail_url,
      shortPitchJa: m?.short_pitch_ja ?? null,
      englishBarrier: m?.english_barrier ?? null,
      editorialScoreStream: m?.editorial_score_stream ?? 0,
      bestConfidence: agg.bestConfidence,
      totalVoteCount: agg.totalVoteCount,
      badges,
    });
  });

  result.sort((a, b) => {
    if (b.bestConfidence !== a.bestConfidence) return b.bestConfidence - a.bestConfidence;
    if (b.editorialScoreStream !== a.editorialScoreStream)
      return b.editorialScoreStream - a.editorialScoreStream;
    return b.totalVoteCount - a.totalVoteCount;
  });
  return result.slice(0, limit);
}

export function pickBadges(
  candidates: Iterable<string>,
  limit = 3
): string[] {
  const set = new Set(candidates);
  const ordered: string[] = [];
  for (const id of BADGE_PRIORITY) {
    if (set.has(id)) ordered.push(id);
    if (ordered.length >= limit) break;
  }
  // 優先度外のタグも残枠に詰める
  if (ordered.length < limit) {
    set.forEach((id) => {
      if (ordered.length >= limit) return;
      if (ordered.includes(id)) return;
      ordered.push(id);
    });
  }
  return ordered;
}

export function englishBarrierLabel(v: EnglishBarrier): string {
  return v === 'low' ? '英語ハードル 低' : v === 'mid' ? '英語ハードル 中' : '英語ハードル 高';
}

// ============ バリデーション ============

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface StreamMetaInput {
  short_pitch_ja: string;
  stream_summary_ja: string;
  stream_points: string[];
  solo_fit: string;
  collab_fit: string;
  viewer_participation_fit: string;
  clip_fit: string;
  english_barrier: string;
  learning_curve: string;
  first_10min_guide: string;
  why_now_popular: string;
  stream_caution_notes: Array<{
    id: string;
    label: string;
    body: string;
    severity: string;
  }>;
  recommended_party_size: string;
  average_session_length: string;
  share_card_enabled: boolean;
  editorial_score_stream: number;
}

function inSet<T extends string>(v: unknown, set: readonly T[]): v is T {
  return typeof v === 'string' && (set as readonly string[]).includes(v);
}

function lenBetween(s: unknown, min: number, max: number): s is string {
  return typeof s === 'string' && s.length >= min && s.length <= max;
}

export function validateStreamMeta(input: unknown): {
  ok: boolean;
  issues: ValidationIssue[];
  value?: StreamMetaInput;
} {
  const issues: ValidationIssue[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, issues: [{ field: '', message: 'invalid body' }] };
  }
  const b = input as Record<string, unknown>;

  if (!lenBetween(b.short_pitch_ja, 5, 60))
    issues.push({ field: 'short_pitch_ja', message: '5〜60文字' });
  if (!lenBetween(b.stream_summary_ja, 10, 200))
    issues.push({ field: 'stream_summary_ja', message: '10〜200文字' });

  const pts = b.stream_points;
  if (!Array.isArray(pts) || pts.length > 3)
    issues.push({ field: 'stream_points', message: '最大3件の配列' });
  else if (pts.some((p) => typeof p !== 'string' || p.length < 3 || p.length > 40))
    issues.push({ field: 'stream_points', message: '各3〜40文字' });

  for (const f of ['solo_fit', 'collab_fit', 'viewer_participation_fit', 'clip_fit'] as const) {
    if (!inSet(b[f], FIT_LEVELS))
      issues.push({ field: f, message: 'high / mid / low' });
  }
  if (!inSet(b.english_barrier, ENGLISH_BARRIERS))
    issues.push({ field: 'english_barrier', message: 'low / mid / high' });
  if (!inSet(b.learning_curve, LEARNING_CURVES))
    issues.push({ field: 'learning_curve', message: 'easy / normal / hard' });

  if (typeof b.first_10min_guide !== 'string' || (b.first_10min_guide as string).length > 300)
    issues.push({ field: 'first_10min_guide', message: '300字以内' });
  if (typeof b.why_now_popular !== 'string' || (b.why_now_popular as string).length > 200)
    issues.push({ field: 'why_now_popular', message: '200字以内' });

  const notes = b.stream_caution_notes;
  if (!Array.isArray(notes) || notes.length > 6) {
    issues.push({ field: 'stream_caution_notes', message: '最大6件' });
  } else {
    notes.forEach((n, i) => {
      if (!n || typeof n !== 'object') {
        issues.push({ field: `stream_caution_notes[${i}]`, message: 'オブジェクト必須' });
        return;
      }
      const note = n as Record<string, unknown>;
      if (typeof note.label !== 'string' || (note.label as string).length > 20)
        issues.push({ field: `stream_caution_notes[${i}].label`, message: '20字以内' });
      if (typeof note.body !== 'string' || (note.body as string).length > 120)
        issues.push({ field: `stream_caution_notes[${i}].body`, message: '120字以内' });
      if (!inSet(note.severity, CAUTION_SEVERITIES))
        issues.push({ field: `stream_caution_notes[${i}].severity`, message: 'info / warn' });
    });
  }

  if (typeof b.recommended_party_size !== 'string' || (b.recommended_party_size as string).length > 20)
    issues.push({ field: 'recommended_party_size', message: '20字以内' });
  if (typeof b.average_session_length !== 'string' || (b.average_session_length as string).length > 30)
    issues.push({ field: 'average_session_length', message: '30字以内' });
  if (typeof b.share_card_enabled !== 'boolean')
    issues.push({ field: 'share_card_enabled', message: 'boolean' });
  const score = b.editorial_score_stream;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100)
    issues.push({ field: 'editorial_score_stream', message: '0〜100の整数' });

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    issues: [],
    value: {
      short_pitch_ja: b.short_pitch_ja as string,
      stream_summary_ja: b.stream_summary_ja as string,
      stream_points: pts as string[],
      solo_fit: b.solo_fit as FitLevel,
      collab_fit: b.collab_fit as FitLevel,
      viewer_participation_fit: b.viewer_participation_fit as FitLevel,
      clip_fit: b.clip_fit as FitLevel,
      english_barrier: b.english_barrier as EnglishBarrier,
      learning_curve: b.learning_curve as LearningCurve,
      first_10min_guide: (b.first_10min_guide as string) ?? '',
      why_now_popular: (b.why_now_popular as string) ?? '',
      stream_caution_notes: notes as StreamMetaInput['stream_caution_notes'],
      recommended_party_size: (b.recommended_party_size as string) ?? '',
      average_session_length: (b.average_session_length as string) ?? '',
      share_card_enabled: b.share_card_enabled as boolean,
      editorial_score_stream: b.editorial_score_stream as number,
    },
  };
}

/** stream-meta 入力に対する文言モデレーション（全テキストフィールドを集約チェック） */
export function collectMetaTexts(input: StreamMetaInput): Record<string, string> {
  const out: Record<string, string> = {
    short_pitch_ja: input.short_pitch_ja,
    stream_summary_ja: input.stream_summary_ja,
    first_10min_guide: input.first_10min_guide,
    why_now_popular: input.why_now_popular,
    recommended_party_size: input.recommended_party_size,
    average_session_length: input.average_session_length,
  };
  input.stream_points.forEach((p, i) => (out[`stream_points[${i}]`] = p));
  input.stream_caution_notes.forEach((n, i) => {
    out[`stream_caution_notes[${i}].label`] = n.label;
    out[`stream_caution_notes[${i}].body`] = n.body;
  });
  return out;
}
