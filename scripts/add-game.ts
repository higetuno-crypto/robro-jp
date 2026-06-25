/**
 * scripts/add-game.ts
 *
 * 単発：検索で拾えないゲームを universe_id 指定で games テーブルに登録する。
 * ensureGameInDb（検索→詳細遷移時の on-demand upsert と同じ経路）を再利用。
 *
 * 使い方：
 *   pnpm dlx tsx scripts/add-game.ts 6004336944
 *   （.env.local はスクリプト先頭で自前ロードするので dotenv-cli 不要）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// --- .env.local を自前ロード（依存追加なし） ---
try {
  const envPath = resolve(process.cwd(), '.env.local');
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  console.warn('[add-game] .env.local が読めませんでした（環境変数が既に設定済みなら無視）');
}

async function main() {
  // env 注入後に読み込ませるため動的 import（lib/supabase は import 時に env を読むため）
  const { ensureGameInDb } = await import('../lib/ensure-game');

  const ids = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    console.error('usage: tsx scripts/add-game.ts <universeId> [universeId ...]');
    process.exit(1);
  }

  let ok = 0;
  for (const universeId of ids) {
    console.log(`[add-game] upserting universe_id=${universeId} ...`);
    const result = await ensureGameInDb(universeId);
    if (!result) {
      console.error(`[add-game] 失敗 universe_id=${universeId}`);
      continue;
    }
    ok++;
    console.log('[add-game] 登録成功:', {
      universeId: result.universeId,
      name: result.name,
      creator: result.creatorName,
      isJapanese: result.isJapanese,
    });
  }
  console.log(`[add-game] done: ${ok}/${ids.length} 件成功`);
  if (ok < ids.length) process.exit(1);
}

main();
