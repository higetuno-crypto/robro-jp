/**
 * seed-stream-meta.ts で投入した9本に、運営として配信向けタグを初期付与する。
 * /stream/[slot] は game_tag_votes.vote_count > 0 のゲームを並べるため、
 * ここで confidence_score と vote_count を底上げし、初期表示を可能にする。
 *
 * 方針：運営投与は vote_count=10（confidence_score = 10/(10+10)=0.5 相当）で入れる。
 * ユーザー投票が後から入れば自然に上書き集計される。
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// universe_id → 付与するタグ
const ASSIGNMENTS: Record<number, string[]> = {
  // Grow a Garden：ソロ放置・雑談向け
  7436755782: ['long_play', 'slow_burn', 'no_english', 'solo_ok'],
  // Adopt Me!：視聴者参加・コラボ・初心者
  383310974: ['viewer_join', 'collab_good', 'easy_rule', 'scale_up'],
  // Heavyweight Fishing：ソロ雑談・長時間
  8342498724: ['solo_ok', 'long_play', 'slow_burn'],
  // RIVALS：コラボFPS・叫ぶ・配信映え
  6035872082: ['collab_good', 'loud_fun', 'reaction_good', 'stream_good'],
  // Restaurant Tycoon 3：コラボ経営
  7094518649: ['collab_good', 'voice_chat_plus', 'scale_up', 'long_play'],
  // Tower of Hell：叫ぶ・短時間・英語不要・リアク
  703124385: ['loud_fun', 'reaction_good', 'short_play', 'easy_rule', 'no_english', 'stream_good'],
  // Build A Boat For Treasure：視聴者参加・ビルド
  210851291: ['viewer_join', 'collab_good', 'easy_rule', 'scale_up'],
  // DOORS：リアク・協力ホラー・配信映え
  2440500124: ['reaction_good', 'loud_fun', 'collab_good', 'stream_good', 'voice_chat_plus'],
  // 99 Nights in the Forest：コラボサバイバル
  7326934954: ['collab_good', 'voice_chat_plus', 'long_play'],
};

const SEED_COUNT = 10;
const K = 10;

async function main() {
  let ok = 0;
  let failed = 0;
  for (const [univStr, tagIds] of Object.entries(ASSIGNMENTS)) {
    const universe_id = Number(univStr);
    for (const tag_id of tagIds) {
      const { error } = await s.from('game_tag_votes').upsert(
        {
          universe_id,
          tag_id,
          vote_count: SEED_COUNT,
          confidence_score: SEED_COUNT / (SEED_COUNT + K),
          last_voted_at: new Date().toISOString(),
        },
        { onConflict: 'universe_id,tag_id' }
      );
      if (error) {
        console.error(`[seed-tags] fail ${universe_id}/${tag_id}`, error.message);
        failed++;
      } else {
        ok++;
      }
    }
  }
  console.log(`done: ok=${ok} failed=${failed}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
