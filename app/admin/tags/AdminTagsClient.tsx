'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TagType, TagGroup } from '@/lib/tags';
import type { AdminTagRow } from './page';
import { moderateText, type ModerationIssue } from '@/lib/moderation';

/**
 * ADMIN-02 タグプール管理 UI。
 *
 * 機能：
 *  - 全タグ一覧（group でグルーピング、is_active 含む）
 *  - 有効/無効のインライン切替（PATCH）
 *  - 新規作成フォーム（MOD-04 NGワードチェックを client 側でも事前に発動）
 *  - 編集フォーム（インライン展開）
 *
 * server API は middleware.ts で Basic 認証保護済み。
 */

const TAG_TYPES: TagType[] = ['official', 'user_selectable', 'free'];
const TAG_GROUPS: TagGroup[] = [
  'format',
  'difficulty',
  'reaction',
  'participation',
  'vibe',
  'caution',
  'genre',
];

const GROUP_LABEL: Record<TagGroup, string> = {
  format: '遊び方',
  difficulty: '難易度・英語',
  reaction: 'リアクション',
  participation: '参加形式',
  vibe: '空気感',
  caution: '注意点',
  genre: 'ジャンル',
};

export function AdminTagsClient({ initialTags }: { initialTags: AdminTagRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<TagGroup, AdminTagRow[]>();
    for (const t of initialTags) {
      const arr = map.get(t.tagGroup) ?? [];
      arr.push(t);
      map.set(t.tagGroup, arr);
    }
    return TAG_GROUPS.filter((g) => map.has(g)).map((g) => ({
      group: g,
      tags: map.get(g)!,
    }));
  }, [initialTags]);

  async function request(
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; error?: string }> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tags', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ field?: string; word: string; suggestion?: string }>;
      };
      if (!res.ok) {
        const detail = json.issues
          ? `: ${json.issues.map((i) => i.word).join(', ')}`
          : '';
        return { ok: false, error: (json.error ?? 'エラー') + detail };
      }
      router.refresh();
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: '通信エラー' };
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: AdminTagRow) {
    const r = await request('PATCH', { tag_id: t.tagId, is_active: !t.isActive });
    if (!r.ok) setError(r.error ?? null);
  }

  return (
    <div className="space-y-6 text-[13px]">
      {error && (
        <div className="px-3 py-2 border border-red-500 text-red-700 bg-red-50">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-[14px] font-semibold mb-2">新規タグを追加</h2>
        <NewTagForm
          busy={busy}
          onSubmit={async (input) => {
            const r = await request('POST', input);
            if (!r.ok) setError(r.error ?? null);
            return r.ok;
          }}
        />
      </section>

      <section>
        <h2 className="text-[14px] font-semibold mb-2">
          既存タグ一覧（{initialTags.length} 件）
        </h2>
        <div className="space-y-6">
          {grouped.map(({ group, tags }) => (
            <div key={group}>
              <h3 className="text-[13px] font-medium mb-1 text-muted-foreground">
                {GROUP_LABEL[group]}（{tags.length}件）
              </h3>
              <ul className="border border-border divide-y divide-border">
                {tags.map((t) => (
                  <li key={t.tagId} className="px-2 py-1.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center text-[12px] leading-none px-2 py-1 shrink-0 ${
                          t.tagType === 'official'
                            ? 'bg-foreground text-background'
                            : 'border border-foreground text-foreground'
                        } ${t.isActive ? '' : 'opacity-40 line-through'}`}
                      >
                        {t.tagName}
                      </span>
                      <code className="text-[11px] text-muted-foreground">{t.tagId}</code>
                      <span className="text-[11px] text-muted-foreground flex-1 truncate">
                        {t.description}
                      </span>
                      <label className="text-[12px] shrink-0">
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={t.isActive}
                          onChange={() => toggleActive(t)}
                          disabled={busy}
                        />
                        有効
                      </label>
                      <button
                        type="button"
                        className="text-[12px] underline shrink-0"
                        onClick={() =>
                          setEditingId(editingId === t.tagId ? null : t.tagId)
                        }
                      >
                        {editingId === t.tagId ? '閉じる' : '編集'}
                      </button>
                    </div>
                    {editingId === t.tagId && (
                      <div className="mt-2 pl-2 border-l-2 border-border">
                        <EditTagForm
                          tag={t}
                          busy={busy}
                          onSubmit={async (patch) => {
                            const r = await request('PATCH', {
                              tag_id: t.tagId,
                              ...patch,
                            });
                            if (r.ok) setEditingId(null);
                            else setError(r.error ?? null);
                            return r.ok;
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ModerationWarnings({ issues }: { issues: ModerationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="text-[11px] space-y-0.5 mt-1">
      {issues.map((i, idx) => (
        <div
          key={idx}
          className={
            i.severity === 'block' ? 'text-red-600' : 'text-amber-700'
          }
        >
          {i.severity === 'block'
            ? `「${i.word}」は使用できません（保存不可）`
            : `「${i.word}」→ 「${i.suggestion}」推奨：${i.reason}`}
        </div>
      ))}
    </div>
  );
}

function NewTagForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tagId, setTagId] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagType, setTagType] = useState<TagType>('user_selectable');
  const [tagGroup, setTagGroup] = useState<TagGroup>('vibe');
  const [description, setDescription] = useState('');
  const [isStreamingRelated, setIsStreamingRelated] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  const nameIssues = moderateText(tagName);
  const descIssues = moderateText(description);
  const hasBlock =
    nameIssues.some((i) => i.severity === 'block') ||
    descIssues.some((i) => i.severity === 'block');

  const canSubmit =
    !busy && tagId.trim() && tagName.trim() && !hasBlock;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await onSubmit({
      tag_id: tagId.trim(),
      tag_name: tagName.trim(),
      tag_type: tagType,
      tag_group: tagGroup,
      description: description.trim() || null,
      is_streaming_related: isStreamingRelated,
      is_active: true,
      sort_order: sortOrder,
    });
    if (ok) {
      setTagId('');
      setTagName('');
      setDescription('');
      setIsStreamingRelated(false);
      setSortOrder(0);
    }
  }

  return (
    <form onSubmit={submit} className="border border-border p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-muted-foreground">tag_id（英小文字_）</span>
          <input
            type="text"
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            required
            pattern="[a-z][a-z0-9_]{1,40}"
            placeholder="example_tag"
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">表示名</span>
          <input
            type="text"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            required
            maxLength={30}
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
          <ModerationWarnings issues={nameIssues} />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">タイプ</span>
          <select
            value={tagType}
            onChange={(e) => setTagType(e.target.value as TagType)}
            className="w-full border border-border px-2 py-1 text-[13px]"
          >
            {TAG_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">グループ</span>
          <select
            value={tagGroup}
            onChange={(e) => setTagGroup(e.target.value as TagGroup)}
            className="w-full border border-border px-2 py-1 text-[13px]"
          >
            {TAG_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}（{GROUP_LABEL[g]}）
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-muted-foreground">説明（任意）</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
          <ModerationWarnings issues={descIssues} />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">sort_order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
        </label>
        <label className="block pt-5">
          <input
            type="checkbox"
            checked={isStreamingRelated}
            onChange={(e) => setIsStreamingRelated(e.target.checked)}
            className="mr-1"
          />
          <span className="text-[12px]">配信関連タグ</span>
        </label>
      </div>
      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1.5 bg-foreground text-background text-[13px] disabled:opacity-40"
        >
          {busy ? '送信中…' : '追加する'}
        </button>
      </div>
    </form>
  );
}

function EditTagForm({
  tag,
  busy,
  onSubmit,
}: {
  tag: AdminTagRow;
  busy: boolean;
  onSubmit: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tagName, setTagName] = useState(tag.tagName);
  const [tagType, setTagType] = useState<TagType>(tag.tagType);
  const [tagGroup, setTagGroup] = useState<TagGroup>(tag.tagGroup);
  const [description, setDescription] = useState(tag.description ?? '');
  const [isStreamingRelated, setIsStreamingRelated] = useState(tag.isStreamingRelated);
  const [sortOrder, setSortOrder] = useState(tag.sortOrder);

  const nameIssues = moderateText(tagName);
  const descIssues = moderateText(description);
  const hasBlock =
    nameIssues.some((i) => i.severity === 'block') ||
    descIssues.some((i) => i.severity === 'block');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasBlock || busy) return;
    await onSubmit({
      tag_name: tagName.trim(),
      tag_type: tagType,
      tag_group: tagGroup,
      description: description.trim() || null,
      is_streaming_related: isStreamingRelated,
      sort_order: sortOrder,
    });
  }

  return (
    <form onSubmit={submit} className="py-2 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-muted-foreground">表示名</span>
          <input
            type="text"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            required
            maxLength={30}
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
          <ModerationWarnings issues={nameIssues} />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">タイプ</span>
          <select
            value={tagType}
            onChange={(e) => setTagType(e.target.value as TagType)}
            className="w-full border border-border px-2 py-1 text-[13px]"
          >
            {TAG_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">グループ</span>
          <select
            value={tagGroup}
            onChange={(e) => setTagGroup(e.target.value as TagGroup)}
            className="w-full border border-border px-2 py-1 text-[13px]"
          >
            {TAG_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">sort_order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-muted-foreground">説明</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-border px-2 py-1 text-[13px]"
          />
          <ModerationWarnings issues={descIssues} />
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={isStreamingRelated}
            onChange={(e) => setIsStreamingRelated(e.target.checked)}
            className="mr-1"
          />
          <span className="text-[12px]">配信関連タグ</span>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy || hasBlock}
        className="px-3 py-1 bg-foreground text-background text-[13px] disabled:opacity-40"
      >
        保存
      </button>
    </form>
  );
}
