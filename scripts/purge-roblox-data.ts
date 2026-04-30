/**
 * Roblox 由来データ緊急削除スクリプト（雛形）。
 *
 * 用途：Roblox から削除要請があった場合、または API アクセス喪失時に、
 * Roblox 由来のデータ（ゲーム情報・CCUスナップショット・配信メタ）を即削除する。
 * CLAUDE.md「運営コンプライアンス」および資料3 L61（データ削除要件）・
 * 2026-04-30 ToS 改定（Creator Terms §7）に対応。
 *
 * ◆ 削除対象テーブル（Roblox由来データ・公開API取得分）：
 *   - games                  （Roblox ゲームメタ）
 *   - game_snapshots         （CCU時系列）
 *   - game_streaming_meta    （配信メタ、Roblox ゲームに紐づく運営編集情報も含む）
 *
 * ◆ FK CASCADE で連動削除されるテーブル（追加実装不要）：
 *   - game_button_votes      （universe_id FK → CASCADE）
 *   - game_tag_votes         （universe_id FK → CASCADE）
 *   - user_savings           （universe_id FK → CASCADE）
 *   - featured_games         （universe_id FK の有無確認）
 *   - creator_games          （universe_id FK → CASCADE、フェーズ10以降）
 *
 * ◆ 保持するテーブル（独自データ・ユーザー投稿・法的保持義務）：
 *   - accounts               （ユーザーアカウント、Roblox由来ではない）
 *   - tag_master             （独自タグマスタ）
 *   - game_tag_vote_logs     （universe_id にFK制約なし。発信者情報開示請求対応のため保持）
 *   - game_button_vote_logs  （universe_id にFK制約なし。同上）
 *   - stream_featured_articles
 *   - stream_slots / stream_slot_tags
 *   - feedback_*             （ご意見ボード、Roblox由来ではない）
 *   - creators               （クリエイター自薦登録、Roblox由来ではない / フェーズ10以降）
 *
 * ◆ 使い方：
 *   pnpm tsx scripts/purge-roblox-data.ts --dry-run  # 件数のみ表示（デフォルト）
 *   pnpm tsx scripts/purge-roblox-data.ts --execute  # 実際に削除（要 --confirm）
 *   pnpm tsx scripts/purge-roblox-data.ts --execute --confirm  # 確認スキップ
 *
 * ◆ 必須環境変数：
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * ◆ 復旧手順：
 *   削除後に状況が解決した場合は、cron（fetch-games）が次回実行で
 *   games / game_snapshots を自動再構築する。game_streaming_meta は
 *   admin 画面で再投入が必要。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TABLES_TO_PURGE = [
  'game_streaming_meta',
  'game_snapshots',
  'games',
] as const;

type Mode = 'dry-run' | 'execute';

interface ParsedArgs {
  mode: Mode;
  skipConfirm: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const hasDryRun = argv.includes('--dry-run');
  const hasExecute = argv.includes('--execute');
  const skipConfirm = argv.includes('--confirm');

  if (hasExecute && hasDryRun) {
    throw new Error('--dry-run と --execute は同時に指定できません');
  }
  if (!hasExecute && !hasDryRun) {
    // 安全側：明示しなければ dry-run 扱い
    return { mode: 'dry-run', skipConfirm };
  }
  return { mode: hasExecute ? 'execute' : 'dry-run', skipConfirm };
}

async function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    const onData = (chunk: string) => {
      buf += chunk;
      const idx = buf.indexOf('\n');
      if (idx >= 0) {
        process.stdin.off('data', onData);
        process.stdin.pause();
        resolve(buf.slice(0, idx).replace(/\r$/, ''));
      }
    };
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL および SUPABASE_SERVICE_ROLE_KEY を設定してください',
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function countRows(
  client: SupabaseClient,
  table: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    throw new Error(`[${table}] 件数取得に失敗: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteAll(client: SupabaseClient, table: string): Promise<void> {
  // Supabase JS クライアントから直接 TRUNCATE は叩けないため、
  // 全行 delete で代替する。件数が多い場合は SQL エディタで TRUNCATE 実行を推奨。
  const { error } = await client.from(table).delete().not('universe_id', 'is', null);
  if (error) {
    throw new Error(`[${table}] 削除に失敗: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const { mode, skipConfirm } = parseArgs(process.argv.slice(2));
  const client = createAdminClient();

  console.log(`[purge-roblox-data] mode=${mode}`);
  console.log('[purge-roblox-data] 対象テーブル:', TABLES_TO_PURGE.join(', '));

  // 削除前の件数表示（dry-run でも execute でも先に表示）
  const counts: Array<{ table: string; before: number }> = [];
  for (const table of TABLES_TO_PURGE) {
    const before = await countRows(client, table);
    counts.push({ table, before });
    console.log(`[${table}] 現在: ${before} 行`);
  }

  if (mode === 'dry-run') {
    console.log('\n[purge-roblox-data] dry-run のため削除は実行していません。');
    console.log('[purge-roblox-data] 実行する場合は --execute を指定してください。');
    return;
  }

  // execute 確認プロンプト（--confirm でスキップ可能）
  if (!skipConfirm) {
    const total = counts.reduce((sum, c) => sum + c.before, 0);
    console.log('\n⚠️  Roblox 由来データを上記件数すべて削除します（合計 %d 行）。', total);
    console.log('   関連テーブル（game_button_votes / user_savings 等）は FK CASCADE で連動削除されます。');
    console.log('   game_button_vote_logs / game_tag_vote_logs は保持されます（発信者情報開示請求対応）。');
    const ans = await readLine('続行しますか？ "yes" と入力して下さい: ');
    if (ans.trim().toLowerCase() !== 'yes') {
      console.log('[purge-roblox-data] キャンセルされました。');
      return;
    }
  }

  for (const { table } of counts) {
    await deleteAll(client, table);
    const after = await countRows(client, table);
    console.log(`[${table}] 削除後: ${after} 行`);
  }

  console.log('\n[purge-roblox-data] 削除完了。');
  console.log('[purge-roblox-data] 復旧時は cron（fetch-games）が games / game_snapshots を自動再構築します。');
  console.log('[purge-roblox-data] game_streaming_meta は admin 画面から手動再投入が必要です。');
}

main().catch((err) => {
  console.error('[purge-roblox-data] エラー:', err);
  process.exit(1);
});
