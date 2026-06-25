/**
 * scripts/verify-rpc-lockdown.ts
 *
 * 書き込み系 SECURITY DEFINER RPC が anon（未ログイン）から直接叩けないことを検証する。
 * 0026_lockdown_write_rpcs.sql を本番に適用した後に実行して、全て BLOCKED(42501) になればOK。
 *
 * 使い方：
 *   npx -y tsx scripts/verify-rpc-lockdown.ts
 *
 * 非破壊：いずれの引数も「権限チェック or 入力検証で弾かれる」値にしてあり、
 *         仮に anon が実行できてもデータは永続化されない（CHECK / FK / RAISE で rollback）。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const tests: [string, Record<string, unknown>][] = [
    ['vote_strategy_tip', { p_tip_id: -1, p_account_id: null, p_fingerprint: 'probe' }],
    ['cast_tag_vote', { p_universe_id: null, p_tag_id: null, p_account_id: null, p_fingerprint: 'probe' }],
    ['toggle_feedback_vote_atomic', { p_post_id: -1, p_account_id: null, p_fingerprint: 'probe' }],
    ['cast_button_vote_atomic', { p_universe_id: -1, p_button_type: 'like', p_account_id: null, p_fingerprint: 'probe', p_vote_value: 1 }],
    ['post_strategy_tip', { p_universe_id: -1, p_category: 'other', p_body: '', p_account_id: null, p_fingerprint: 'probe', p_ip: '0.0.0.0', p_user_agent: 'probe' }],
    ['report_strategy_tip', { p_tip_id: -1, p_reason: 'spam', p_detail: null, p_fingerprint: 'probe' }],
  ];

  let openCount = 0;
  for (const [fn, args] of tests) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await anon.rpc(fn, args as any);
    const blocked = error?.code === '42501';
    if (blocked) {
      console.log(`✓ BLOCKED  ${fn}  (42501 permission denied)`);
    } else {
      openCount++;
      console.log(`✗ OPEN     ${fn}  (anon が実行できた: ${error ? error.code + ' ' + error.message : 'SUCCESS'})`);
    }
  }
  console.log('');
  if (openCount === 0) {
    console.log('✅ 全ての書き込み RPC が service_role 限定でロックされています。');
  } else {
    console.log(`⚠️  ${openCount} 件がまだ anon から実行可能です。0026 を本番に適用してください。`);
    process.exit(1);
  }
}

main();
