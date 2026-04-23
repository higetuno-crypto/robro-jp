/**
 * Roblox 由来データ緊急削除スクリプト（雛形）。
 *
 * 用途：Roblox から削除要請があった場合、または API アクセス喪失時に、
 * Roblox 由来のデータ（ゲーム情報・CCUスナップショット・配信メタ）を即削除する。
 * CLAUDE.md「運営コンプライアンス」および資料3 L61（データ削除要件）に対応。
 *
 * 削除対象テーブル：
 *   - games                  （Roblox ゲームメタ）
 *   - game_snapshots         （CCU時系列）
 *   - game_streaming_meta    （配信メタ、Roblox ゲームに紐づく運営編集情報も含む）
 *
 * 保持するテーブル（独自データ・ユーザー投稿）：
 *   - tag_master
 *   - game_tag_votes         （ゲーム削除でCASCADE削除される分は許容）
 *   - game_tag_vote_logs     （発信者情報開示請求対応のため保持）
 *   - featured_games         （CASCADEでゲーム参照が外れる場合は手動クリーンアップ）
 *   - stream_featured_articles
 *   - stream_slots / stream_slot_tags
 *
 * 使い方：
 *   pnpm tsx scripts/purge-roblox-data.ts --dry-run  # 件数のみ表示
 *   pnpm tsx scripts/purge-roblox-data.ts --execute  # 実際に削除
 *
 * 必須環境変数：
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * TODO（Yuki 確認後に実装）：
 *   - 削除実行前に管理者確認プロンプトを追加
 *   - 削除ログを supabase の監査テーブルへ記録
 *   - Slack/メール通知
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TABLES_TO_PURGE = [
  'game_streaming_meta',
  'game_snapshots',
  'games',
] as const;

type Mode = 'dry-run' | 'execute';

function parseArgs(argv: string[]): Mode {
  const hasDryRun = argv.includes('--dry-run');
  const hasExecute = argv.includes('--execute');

  if (hasExecute && hasDryRun) {
    throw new Error('--dry-run と --execute は同時に指定できません');
  }
  if (!hasExecute && !hasDryRun) {
    // 安全側：明示しなければ dry-run 扱い
    return 'dry-run';
  }
  return hasExecute ? 'execute' : 'dry-run';
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
  const mode = parseArgs(process.argv.slice(2));
  const client = createAdminClient();

  console.log(`[purge-roblox-data] mode=${mode}`);
  console.log('[purge-roblox-data] 対象テーブル:', TABLES_TO_PURGE.join(', '));

  for (const table of TABLES_TO_PURGE) {
    const before = await countRows(client, table);
    console.log(`[${table}] 削除前: ${before} 行`);

    if (mode === 'execute') {
      await deleteAll(client, table);
      const after = await countRows(client, table);
      console.log(`[${table}] 削除後: ${after} 行`);
    }
  }

  if (mode === 'dry-run') {
    console.log('[purge-roblox-data] dry-run のため削除は実行していません。');
    console.log('[purge-roblox-data] 実行する場合は --execute を指定してください。');
  } else {
    console.log('[purge-roblox-data] 削除完了。');
  }
}

main().catch((err) => {
  console.error('[purge-roblox-data] エラー:', err);
  process.exit(1);
});
