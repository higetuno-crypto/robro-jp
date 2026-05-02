/**
 * Sprint 1 用：10本のゲームに game_streaming_meta をシードするスクリプト。
 *
 * 使い方：
 *   pnpm tsx scripts/seed-stream-meta.ts
 *
 * 対象 universe_id は CANDIDATES に列挙。games テーブルに存在するものだけ upsert する。
 * universe_id はトップランキングから手動で拾って差し替えてください。
 *
 * 注意：
 *  - 文言は運営のドラフト。本番公開前に /admin/stream-meta/[id] でレビューすること
 *  - 禁止語が混入しないよう lib/moderation.ts の辞書と突き合わせ済
 */

import { createClient } from '@supabase/supabase-js';
import { validateStreamMeta } from '../lib/streaming';
import { moderateFields, hasBlockingIssue } from '../lib/moderation';

// .env.local を読み込みたい場合は実行時に `dotenv-cli` を噛ませてください：
//   pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/seed-stream-meta.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

type MetaInput = Parameters<typeof validateStreamMeta>[0];

interface Candidate {
  universe_id: number;
  note: string; // デバッグ用：どのゲームか
  meta: MetaInput;
}

/**
 * 10本のドラフト。universe_id は稼働中ランキングから取得し直してください。
 * ここでは「DBに存在すれば書き込み、なければスキップ」する安全側の挙動にしています。
 */
const CANDIDATES: Candidate[] = [
  // higesakusei/配信おすすめゲーム.txt の9本。文言はドラフト、/admin/stream-meta/[id] でレビュー想定。
  {
    universe_id: 7436755782,
    note: 'Grow a Garden',
    meta: buildMeta({
      shortPitch: '庭を育てる癒し系放置シミュ',
      summary:
        '作物の成長がASMR級に癒し系。長期配信で「今日の収穫報告」が視聴者と自然に共有できます。',
      points: [
        '放置系で長時間配信の画が持つ',
        '収穫のビジュアルが映える',
        '視聴者と進捗を共有しやすい',
      ],
      fit: ['high', 'mid', 'mid', 'low'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '最初は種選びと庭レイアウト。視聴者のおすすめを聞きながら進めると雑談が回ります。',
      whyNow: '癒し・放置系の需要が根強く、夜帯の固定枠に合うタイトル。',
      cautions: [],
      party: '1人',
      session: '60〜180分',
      score: 70,
    }),
  },
  {
    universe_id: 383310974,
    note: 'Adopt Me!',
    meta: buildMeta({
      shortPitch: 'レアペット孵化とトレードの定番',
      summary:
        'レアペット孵化・トレードの「当たった！」瞬間が大盛り上がり。視聴者参加の卵孵化企画や取引配信がしやすい。',
      points: ['孵化の瞬間が映える', 'トレード企画が作れる', '視聴者参加のハードルが低い'],
      fit: ['mid', 'mid', 'high', 'high'],
      englishBarrier: 'mid',
      learningCurve: 'easy',
      first10min: '最初10分はアバター作成と街歩き。10分以降から卵購入→孵化の流れが安定。',
      whyNow: '家族向けペットシミュとして長年安定。Vtuberの視聴者参加企画と相性が良い。',
      cautions: [],
      party: '2〜4人',
      session: '30〜90分',
      score: 68,
    }),
  },
  {
    universe_id: 8342498724,
    note: 'Heavyweight Fishing',
    meta: buildMeta({
      shortPitch: 'のんびり大物狙いの釣りアドベンチャー',
      summary:
        '島を巡ってレア魚を釣る、雑談や「今日の釣果自慢」に最適なタイトル。リラックス配信で固定ファンが付きやすい。',
      points: ['雑談配信と相性が良い', 'レア魚ヒットの瞬間が画になる', '長時間配信でも間が持つ'],
      fit: ['high', 'mid', 'mid', 'mid'],
      englishBarrier: 'mid',
      learningCurve: 'easy',
      first10min: '最初10分で竿と餌を揃え、近場のポイントで1匹目を釣るまで。',
      whyNow: 'のんびり釣り系の需要が安定しており、アーカイブ視聴も伸びやすい。',
      cautions: [
        { label: 'BGM', body: 'BGMの音量が大きめ。ゲーム内音量を下げて配信すると良い', severity: 'info' },
      ],
      party: '1〜2人',
      session: '60〜120分',
      score: 62,
    }),
  },
  {
    universe_id: 6035872082,
    note: 'RIVALS',
    meta: buildMeta({
      shortPitch: '本格アリーナFPSの競技配信枠',
      summary:
        'エイム自慢やコミカルな死に方でリアクションが取りやすい本格FPS。競技配信で視聴者が熱狂するタイプ。',
      points: ['エイムの見せ場が作れる', 'やられシーンが画になる', 'クリップ量産向き'],
      fit: ['high', 'high', 'mid', 'high'],
      englishBarrier: 'mid',
      learningCurve: 'normal',
      first10min: '1試合目は感覚をつかむ用。2試合目以降から視聴者とビルド・立ち回り談義が回ります。',
      whyNow: 'FPS競技配信の層は厚く、Roblox系で差別化しやすい。',
      cautions: [],
      party: '1〜4人',
      session: '30〜90分',
      score: 74,
    }),
  },
  {
    universe_id: 7094518649,
    note: 'Restaurant Tycoon 3',
    meta: buildMeta({
      shortPitch: '注文対応のドタバタが笑える経営ゲー',
      summary:
        'お店経営と料理協力。注文対応のドタバタが笑いを取れて、友達や視聴者参加でカオス配信になります。',
      points: ['協力プレイのドタバタが画になる', '役割分担が自然に生まれる', '長時間でも飽きにくい'],
      fit: ['mid', 'high', 'high', 'mid'],
      englishBarrier: 'mid',
      learningCurve: 'normal',
      first10min: '最初10分は店舗セットアップ。視聴者参加はお店が回り始めてからがスムーズ。',
      whyNow: '経営×協力の王道で、コラボ配信のレギュラー化しやすい構造。',
      cautions: [],
      party: '2〜4人',
      session: '60〜120分',
      score: 64,
    }),
  },
  {
    universe_id: 703124385,
    note: 'Tower of Hell',
    meta: buildMeta({
      shortPitch: '落ちまくって笑う高難易度obby',
      summary:
        '高難易度obbyで落ちまくりの笑いリアクションが連発。短時間配信でも視聴者と競争企画が成立します。',
      points: ['落ちるたびに笑いが取れる', '視聴者との競争企画が作れる', '短尺切り抜きに向く'],
      fit: ['high', 'high', 'high', 'high'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '1タワー目は操作慣らし。3タワー目から視聴者と順位競争を始めると盛り上がります。',
      whyNow: '純粋スキル系obbyは配信定番。暴力ゼロで家族向け配信者にも安心。',
      cautions: [],
      party: '1〜8人',
      session: '20〜60分',
      score: 72,
    }),
  },
  {
    universe_id: 210851291,
    note: 'Build A Boat For Treasure',
    meta: buildMeta({
      shortPitch: '変な船で宝探し、沈む瞬間が画になる',
      summary:
        '自由に船を作って海冒険。変な船が沈む瞬間や宝探しのワクワクがビジュアル＆リアクション満載。',
      points: ['船のビルドが個性を出せる', '沈む瞬間が切り抜き映え', '視聴者とビルド相談が楽しい'],
      fit: ['mid', 'high', 'high', 'high'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '最初10分は簡単な船でチャレンジ。2周目から視聴者と船デザイン相談が回ります。',
      whyNow: 'ビルド×冒険のクラシック。世代を問わず親しまれるタイトル。',
      cautions: [],
      party: '1〜4人',
      session: '30〜60分',
      score: 66,
    }),
  },
  {
    universe_id: 2440500124,
    note: 'DOORS',
    meta: buildMeta({
      shortPitch: 'ジャンプスケア連発の協力ホラー',
      summary:
        '無限ホテル探索のジャンプスケアホラー。coopで「隠れて！」「走れ！」と叫びながら進むリアクションが最高。',
      points: ['ジャンプスケアでリアクションが取れる', '協力プレイの掛け合いが画になる', '短尺でも長尺でもOK'],
      fit: ['mid', 'high', 'mid', 'high'],
      englishBarrier: 'low',
      learningCurve: 'normal',
      first10min: '最初10分で主要エンティティを把握。2周目から視聴者参加で雰囲気が一気に出ます。',
      whyNow: 'ホラー系配信の定番。非著作権BGMで安心度が高いタイトル。',
      cautions: [
        { label: '年齢感', body: 'Mild恐怖あり。視聴者層に合わせて配信前に告知推奨', severity: 'info' },
      ],
      party: '1〜4人',
      session: '30〜90分',
      score: 80,
    }),
  },
  {
    universe_id: 7326934954,
    note: '99 Nights in the Forest',
    meta: buildMeta({
      shortPitch: 'コラボ配信の定番になれる協力サバイバル',
      summary:
        '通話前提のコラボで化けるタイプ。役割分担が自然に発生し、長時間配信でも間が持ちます。',
      points: ['役割分担が自然', '長時間でも飽きにくい', '通話コラボで映える'],
      fit: ['mid', 'high', 'mid', 'mid'],
      englishBarrier: 'mid',
      learningCurve: 'normal',
      first10min: '最初10分は拠点作り。視聴者参加は夜イベント中が回しやすい。',
      whyNow: 'コラボ配信のレギュラー化がしやすく、シリーズもので伸ばせる余地があります。',
      cautions: [],
      party: '2〜4人',
      session: '60〜120分',
      score: 70,
    }),
  },
];

interface BuildArgs {
  shortPitch: string;
  summary: string;
  points: string[];
  fit: ['high' | 'mid' | 'low', 'high' | 'mid' | 'low', 'high' | 'mid' | 'low', 'high' | 'mid' | 'low'];
  englishBarrier: 'low' | 'mid' | 'high';
  learningCurve: 'easy' | 'normal' | 'hard';
  first10min: string;
  whyNow: string;
  cautions: Array<{ label: string; body: string; severity: 'info' | 'warn' }>;
  party: string;
  session: string;
  score: number;
}

function buildMeta(a: BuildArgs): MetaInput {
  return {
    short_pitch_ja: a.shortPitch,
    stream_summary_ja: a.summary,
    stream_points: a.points,
    solo_fit: a.fit[0],
    collab_fit: a.fit[1],
    viewer_participation_fit: a.fit[2],
    clip_fit: a.fit[3],
    english_barrier: a.englishBarrier,
    learning_curve: a.learningCurve,
    first_10min_guide: a.first10min,
    why_now_popular: a.whyNow,
    stream_caution_notes: a.cautions.map((n, i) => ({
      id: `n${i + 1}`,
      label: n.label,
      body: n.body,
      severity: n.severity,
    })),
    recommended_party_size: a.party,
    average_session_length: a.session,
    share_card_enabled: true,
    editorial_score_stream: a.score,
  };
}

async function main() {
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of CANDIDATES) {
    // バリデーション + モデレーション
    const v = validateStreamMeta(c.meta);
    if (!v.ok || !v.value) {
      console.error(`[seed] ${c.universe_id} (${c.note}) validation failed`, v.issues);
      failed++;
      continue;
    }
    const textMap: Record<string, string> = {
      short_pitch: v.value.short_pitch_ja,
      summary: v.value.stream_summary_ja,
      first10: v.value.first_10min_guide,
      whyNow: v.value.why_now_popular,
    };
    v.value.stream_points.forEach((p, i) => (textMap[`point${i}`] = p));
    v.value.stream_caution_notes.forEach((n, i) => {
      textMap[`note${i}_label`] = n.label;
      textMap[`note${i}_body`] = n.body;
    });
    const modIssues = moderateFields(textMap);
    if (modIssues.some((f) => hasBlockingIssue(f.issues))) {
      console.error(
        `[seed] ${c.universe_id} (${c.note}) moderation blocked`,
        modIssues
      );
      failed++;
      continue;
    }

    const { data: game } = await supabase
      .from('games')
      .select('universe_id')
      .eq('universe_id', c.universe_id)
      .maybeSingle();
    if (!game) {
      console.log(`[seed] universe ${c.universe_id} (${c.note}) は未登録のためスキップ`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('game_streaming_meta').upsert(
      {
        universe_id: c.universe_id,
        short_pitch_ja: v.value.short_pitch_ja,
        stream_summary_ja: v.value.stream_summary_ja,
        stream_points: v.value.stream_points,
        solo_fit: v.value.solo_fit,
        collab_fit: v.value.collab_fit,
        viewer_participation_fit: v.value.viewer_participation_fit,
        clip_fit: v.value.clip_fit,
        english_barrier: v.value.english_barrier,
        learning_curve: v.value.learning_curve,
        first_10min_guide: v.value.first_10min_guide,
        why_now_popular: v.value.why_now_popular,
        stream_caution_notes: v.value.stream_caution_notes,
        recommended_party_size: v.value.recommended_party_size,
        average_session_length: v.value.average_session_length,
        share_card_enabled: v.value.share_card_enabled,
        editorial_score_stream: v.value.editorial_score_stream,
      },
      { onConflict: 'universe_id' }
    );
    if (error) {
      console.error(`[seed] ${c.universe_id} (${c.note}) upsert error`, error);
      failed++;
      continue;
    }
    console.log(`[seed] ok universe=${c.universe_id} (${c.note})`);
    ok++;
  }

  console.log(`\n=== done: ok=${ok} skipped=${skipped} failed=${failed} ===`);
  if (skipped > 0) {
    console.log(
      'universe_id を最新ランキング（https://ro-brojp.com/）のものに差し替えて再実行してください。'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
