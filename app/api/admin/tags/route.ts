import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { moderateFields, hasBlockingIssue } from '@/lib/moderation';

/**
 * ADMIN-02 タグプール管理 API。
 *
 * middleware.ts で /api/admin/* は Basic 認証済み。ここでは認可チェックしない。
 *
 * POST /api/admin/tags      : 新規作成
 * PATCH /api/admin/tags     : { tag_id, ...patch } 部分更新
 * DELETE /api/admin/tags?tag_id=xxx : 有効/無効切替ではなく is_active=false を推奨
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TAG_TYPES = ['official', 'user_selectable', 'free'] as const;
const VALID_TAG_GROUPS = [
  'format',
  'reaction',
  'participation',
  'caution',
  'difficulty',
  'vibe',
  'genre',
] as const;

type TagType = (typeof VALID_TAG_TYPES)[number];
type TagGroup = (typeof VALID_TAG_GROUPS)[number];

interface TagInput {
  tag_id: string;
  tag_name: string;
  tag_type: TagType;
  tag_group: TagGroup;
  description?: string | null;
  is_streaming_related?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function validateTagInput(body: unknown): TagInput | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid body' };
  const b = body as Record<string, unknown>;
  if (!isString(b.tag_id) || !/^[a-z][a-z0-9_]{1,40}$/.test(b.tag_id)) {
    return { error: 'tag_id は 小文字英数と _ のみ（2-41字、先頭は英字）' };
  }
  if (!isString(b.tag_name) || b.tag_name.length === 0 || b.tag_name.length > 30) {
    return { error: 'tag_name は 1-30字' };
  }
  if (!isString(b.tag_type) || !VALID_TAG_TYPES.includes(b.tag_type as TagType)) {
    return { error: 'tag_type が不正' };
  }
  if (!isString(b.tag_group) || !VALID_TAG_GROUPS.includes(b.tag_group as TagGroup)) {
    return { error: 'tag_group が不正' };
  }
  return {
    tag_id: b.tag_id,
    tag_name: b.tag_name,
    tag_type: b.tag_type as TagType,
    tag_group: b.tag_group as TagGroup,
    description: isString(b.description) ? b.description : null,
    is_streaming_related: b.is_streaming_related === true,
    is_active: b.is_active !== false,
    sort_order: typeof b.sort_order === 'number' ? b.sort_order : 0,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = validateTagInput(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // MOD-04：NGワードチェック（管理者入力にも効かせる。ブロック系のみ阻止）
  const modIssues = moderateFields({
    tag_name: parsed.tag_name,
    description: parsed.description ?? '',
  });
  const blocking = modIssues.flatMap((f) =>
    f.issues.filter((i) => i.severity === 'block').map((i) => ({ field: f.field, ...i }))
  );
  if (blocking.length > 0) {
    return NextResponse.json(
      { error: 'moderation blocked', issues: blocking },
      { status: 422 }
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('tag_master').insert({
    tag_id: parsed.tag_id,
    tag_name: parsed.tag_name,
    tag_type: parsed.tag_type,
    tag_group: parsed.tag_group,
    description: parsed.description,
    is_streaming_related: parsed.is_streaming_related,
    is_active: parsed.is_active,
    sort_order: parsed.sort_order,
  });
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'その tag_id は既に存在します' },
        { status: 409 }
      );
    }
    console.error('[admin/tags POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath('/tags');
  revalidatePath('/admin/tags');
  return NextResponse.json({ ok: true, tag: parsed });
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (!isString(b.tag_id)) {
    return NextResponse.json({ error: 'tag_id required' }, { status: 400 });
  }
  const tagId = b.tag_id;

  // 部分更新可能なフィールド
  const patch: Record<string, unknown> = {};
  if (isString(b.tag_name)) {
    if (b.tag_name.length === 0 || b.tag_name.length > 30) {
      return NextResponse.json({ error: 'tag_name は 1-30字' }, { status: 400 });
    }
    patch.tag_name = b.tag_name;
  }
  if (isString(b.tag_type) && VALID_TAG_TYPES.includes(b.tag_type as TagType)) {
    patch.tag_type = b.tag_type;
  }
  if (isString(b.tag_group) && VALID_TAG_GROUPS.includes(b.tag_group as TagGroup)) {
    patch.tag_group = b.tag_group;
  }
  if ('description' in b) patch.description = isString(b.description) ? b.description : null;
  if (typeof b.is_streaming_related === 'boolean') patch.is_streaming_related = b.is_streaming_related;
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (typeof b.sort_order === 'number') patch.sort_order = b.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '更新フィールドがありません' }, { status: 400 });
  }

  // MOD-04 再チェック（更新時も適用）
  const modIssues = moderateFields({
    tag_name: (patch.tag_name as string) ?? '',
    description: (patch.description as string) ?? '',
  });
  if (modIssues.some((f) => hasBlockingIssue(f.issues))) {
    return NextResponse.json(
      { error: 'moderation blocked', issues: modIssues },
      { status: 422 }
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('tag_master').update(patch).eq('tag_id', tagId);
  if (error) {
    console.error('[admin/tags PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath('/tags');
  revalidatePath('/admin/tags');
  return NextResponse.json({ ok: true, tag_id: tagId, patch });
}
