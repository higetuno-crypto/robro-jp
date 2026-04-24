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
  // --- 1〜10：日本で人気の上位ゲームを想定したテンプレ。universe_id は要差し替え ---
  {
    universe_id: 1111111111,
    note: 'コラボ鬼ごっこ系ゲーム（例）',
    meta: buildMeta({
      shortPitch: '友達と裏切り合う5分の鬼ごっこ',
      summary:
        'ルールは1分で分かり、毎試合の立ち回りでドラマが生まれます。短尺の切り抜きが特に映えるタイプ。',
      points: [
        'ルール説明が2分で済む',
        '負けた時のリアクションが取りやすい',
        '1試合が短く切り抜き向き',
      ],
      fit: ['mid', 'high', 'mid', 'high'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '2〜3試合でルール理解、3戦目から視聴者参加で回すと盛り上がります。',
      whyNow: 'ショート動画で拡散中。短尺でリアクションが映えます。',
      cautions: [
        { label: '英語依存度', body: 'ルール画面のみ英語、プレイ中は少なめ', severity: 'info' },
        { label: '年齢感', body: '年齢層低めの印象。視聴者層との相性を確認', severity: 'info' },
      ],
      party: '3〜6人',
      session: '1試合5〜10分',
      score: 72,
    }),
  },
  {
    universe_id: 2222222222,
    note: '視聴者参加ロールプレイ系（例）',
    meta: buildMeta({
      shortPitch: '視聴者と街を歩き回れるゆる系RP',
      summary:
        '入室ハードルが低く、視聴者を招いての街歩き配信が成立します。派手さより空気感で勝負。',
      points: ['入室が簡単', 'コメントから行動に繋げやすい', '雑談と相性が良い'],
      fit: ['mid', 'mid', 'high', 'mid'],
      englishBarrier: 'mid',
      learningCurve: 'normal',
      first10min: '最初10分はキャラメイクと街歩き。視聴者参加は2部以降が回しやすい。',
      whyNow: 'Vtuber視聴者参加企画と相性が良く、拡散しやすい空気があります。',
      cautions: [
        { label: '治安', body: '治安に波あり。他プレイヤーの雰囲気で配信向きが変わる', severity: 'warn' },
      ],
      party: '2〜4人',
      session: '30〜60分',
      score: 60,
    }),
  },
  {
    universe_id: 3333333333,
    note: '短時間ホラー（例）',
    meta: buildMeta({
      shortPitch: '5分で終わる協力ホラー',
      summary:
        '短尺でリアクションが映える協力ホラー。初見殺しが多く、ソロでも配信でも回しやすい。',
      points: ['毎試合の死に様が画になる', 'ルール説明不要', 'ソロ配信とも好相性'],
      fit: ['high', 'high', 'mid', 'high'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '1試合で雰囲気が掴めます。2試合目からリスナーに予想させる形式が映える。',
      whyNow: '初見リアク系のショートで拡散中。短尺でクリップが作りやすい。',
      cautions: [
        { label: 'BGM', body: 'BGMに権利配慮の必要な曲が入ることあり。配信前に確認推奨', severity: 'warn' },
      ],
      party: '1〜4人',
      session: '5〜10分',
      score: 78,
    }),
  },
  {
    universe_id: 4444444444,
    note: '視聴者参加カオスミニゲーム（例）',
    meta: buildMeta({
      shortPitch: '大人数でカオスになるミニゲーム集',
      summary:
        '人数が増えるほど化ける系。視聴者参加で盛り上がりやすく、叫ぶ系配信と相性が良い。',
      points: ['人数が増えるほど盛り上がる', '叫ぶ場面が多い', '区切りが自然'],
      fit: ['low', 'high', 'high', 'mid'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '最初は少人数で慣らし、視聴者参加は10分以降から解放が安定。',
      whyNow: '休日夜の視聴者参加枠で回転が良い時間帯に刺さります。',
      cautions: [
        { label: '通信', body: '大人数時はラグあり。音声配信の遅延も合わせて確認を', severity: 'info' },
      ],
      party: '4〜12人',
      session: '20〜40分',
      score: 65,
    }),
  },
  {
    universe_id: 5555555555,
    note: '英語ほぼ不要のソロパズル（例）',
    meta: buildMeta({
      shortPitch: '英語なしで遊べるひとり黙々パズル',
      summary:
        'UIは日本語化されており、英語表記がほぼ出ない。ソロ配信で淡々と進めるタイプ。',
      points: ['英語が出ない', '静かな配信に合う', '進捗が画になる'],
      fit: ['high', 'mid', 'mid', 'mid'],
      englishBarrier: 'low',
      learningCurve: 'normal',
      first10min: 'チュートリアルを実況しながら進めると視聴者が追いつきやすい。',
      whyNow: '配信者コミュニティで「英語不要」需要が増えており、この条件を満たせるタイトルは貴重。',
      cautions: [],
      party: '1人',
      session: '30〜90分',
      score: 55,
    }),
  },
  {
    universe_id: 6666666666,
    note: 'コラボ向きサバイバル（例）',
    meta: buildMeta({
      shortPitch: 'コラボ配信の定番になれる協力サバイバル',
      summary:
        '通話前提のコラボで化けるタイプ。役割分担が自然に発生し、長時間配信でも間が持つ。',
      points: ['役割分担が自然', '長時間でも飽きにくい', '通話コラボで映える'],
      fit: ['mid', 'high', 'mid', 'mid'],
      englishBarrier: 'mid',
      learningCurve: 'normal',
      first10min: '最初10分は拠点作り。視聴者参加は中盤のイベント中が回しやすい。',
      whyNow: 'コラボ配信のレギュラー化がしやすく、シリーズもので伸ばせる余地があります。',
      cautions: [],
      party: '2〜4人',
      session: '60〜120分',
      score: 70,
    }),
  },
  {
    universe_id: 7777777777,
    note: '叫ぶ系対戦（例）',
    meta: buildMeta({
      shortPitch: 'ルール1分・叫んで楽しい対戦',
      summary:
        '瞬発力だけで遊べて、負けた時のリアクションが映える対戦系。短尺向き。',
      points: ['勝ち負けが一瞬', '叫ぶ場面が多い', 'クリップ適性が高い'],
      fit: ['mid', 'high', 'mid', 'high'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: 'すぐ試合に入れるので、視聴者参加と切り替えながら回すのが◎',
      whyNow: '短尺リアクションでバズっている系譜。配信映えしやすい。',
      cautions: [
        { label: '音量', body: '叫ぶ前提なので音声レベルの事前確認を推奨', severity: 'info' },
      ],
      party: '2〜8人',
      session: '15〜30分',
      score: 68,
    }),
  },
  {
    universe_id: 8888888888,
    note: 'じわ沼系経営SIM（例）',
    meta: buildMeta({
      shortPitch: '気づくと時間が消える経営SIM',
      summary:
        '派手さはないが中毒性のあるタイプ。配信では視聴者と進捗を共有する形式が合う。',
      points: ['進捗が追いやすい', '雑談と相性良し', 'アーカイブが見返される'],
      fit: ['high', 'mid', 'mid', 'low'],
      englishBarrier: 'mid',
      learningCurve: 'normal',
      first10min: 'チュートリアル飛ばさず丁寧に。視聴者のアドバイスを拾うと映える。',
      whyNow: '長時間配信のお供として固定化しやすい時間帯（夜帯〜深夜）に強い。',
      cautions: [],
      party: '1人',
      session: '60〜180分',
      score: 58,
    }),
  },
  {
    universe_id: 9999999999,
    note: '初心者向け定番（例）',
    meta: buildMeta({
      shortPitch: '初めてのRobloxに丁度いい入門枠',
      summary:
        'Robloxに初めて触れる人の最初の1本として安定。UIも操作も優しい。',
      points: ['操作が直感的', '英語が少ない', '視聴者も一緒に入りやすい'],
      fit: ['high', 'mid', 'mid', 'mid'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: 'チュートリアルを実況するだけでコンテンツになります。',
      whyNow: 'Roblox入門需要は常時あり、SEO/検索流入も狙える切り口。',
      cautions: [],
      party: '1〜4人',
      session: '20〜40分',
      score: 62,
    }),
  },
  {
    universe_id: 1212121212,
    note: '人数で化けるパーティゲー（例）',
    meta: buildMeta({
      shortPitch: '人数いると化けるパーティ枠',
      summary:
        '少人数では物足りないが、6人以上で劇的に面白くなるタイプ。大型コラボ向き。',
      points: ['大人数で化ける', '企画配信の軸になる', 'ショート素材が量産できる'],
      fit: ['low', 'high', 'high', 'high'],
      englishBarrier: 'low',
      learningCurve: 'easy',
      first10min: '最初は少人数で操作確認、残り時間は視聴者と合流して数を増やす流れが安定。',
      whyNow: '年末年始・GWなどの大型コラボ企画で刺さりやすい時期性があります。',
      cautions: [
        { label: 'サーバー', body: '混雑時にマッチング遅延あり。企画配信時は余裕を持って', severity: 'info' },
      ],
      party: '6〜12人',
      session: '30〜60分',
      score: 66,
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
      'universe_id を最新ランキング（https://robro-jp.vercel.app/）のものに差し替えて再実行してください。'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
