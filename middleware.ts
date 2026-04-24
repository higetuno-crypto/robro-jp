import { NextRequest, NextResponse } from 'next/server';

/**
 * 管理画面 Basic 認証 middleware（ADMIN-01）。
 *
 * 方針（CLAUDE.md と整合）：
 *  - 単独運用者（Yuki）前提 → DB に admin 行を作らず env のみで完結
 *  - NextAuth 等の追加依存を入れない（既存 Supabase スタック内で完結）
 *  - Roblox 規約上のプロファイリング禁止にも抵触しない（何も収集しない）
 *
 * 保護対象：
 *  - /admin/*       : 管理画面
 *  - /api/admin/*   : 管理系API
 *
 * 認証方式：HTTP Basic Auth（Vercel は強制HTTPSなので平文送信問題は実質ない）。
 * 環境変数：
 *  - ADMIN_USERNAME
 *  - ADMIN_PASSWORD
 *  いずれも未設定時は常に 503（誤設定で全公開を避けるため、通すより閉じる）。
 */

const REALM = 'robro-jp admin';

function unauthorized(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

function misconfigured(): NextResponse {
  return new NextResponse('Admin auth not configured', { status: 503 });
}

function timingSafeEqual(a: string, b: string): boolean {
  // 固定時間比較（長さを揃えた上で XOR 累積）
  // Edge Runtime では node:crypto が使えないため自前実装
  if (a.length !== b.length) {
    // 長さが違っても一定時間で返すようダミー比較
    let diff = 1;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diff |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length)) || 0;
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) {
    return misconfigured();
  }

  const header = req.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('basic ')) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return unauthorized();
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(pass, expectedPass)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
