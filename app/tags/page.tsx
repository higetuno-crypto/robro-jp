import Link from 'next/link';
import type { Metadata } from 'next';
import { createBrowserClient } from '@/lib/supabase';
import { fetchTagsWithStats, type TagGroup, type TagStats } from '@/lib/tags';
import { InlineSearchForm } from '@/components/InlineSearchForm';

export const metadata: Metadata = {
  title: 'タグ一覧',
  description: 'ゲームに付けられたタグを人気・新着・カテゴリ別で一覧表示',
};

export const revalidate = 300;

/**
 * /tags
 *
 * CLAUDE.md UI原則（タグページ）：ユーザー集合知の集約・閲覧の場。
 * ランキング・ピックアップとは別物。得票数・新着・カテゴリ（tag_group）で並べ替え。
 * 装飾は最小、ランキング側と同じ淡々としたトーン。
 *
 * ビュー切り替えは ?view=popular|new|group（既定 popular）。
 */

type View = 'popular' | 'new' | 'group';

const GROUP_LABEL: Record<TagGroup, string> = {
  format: '遊び方',
  difficulty: '難易度・英語',
  reaction: 'リアクション',
  participation: '参加形式',
  vibe: '空気感',
  caution: '注意点',
  genre: 'ジャンル',
};

const GROUP_ORDER: TagGroup[] = [
  'format',
  'difficulty',
  'reaction',
  'participation',
  'vibe',
  'caution',
  'genre',
];

function parseView(v: string | undefined): View {
  if (v === 'new' || v === 'group') return v;
  return 'popular';
}

export default async function TagsIndexPage({
  searchParams,
}: {
  searchParams: { view?: string; q?: string };
}) {
  const view = parseView(searchParams.view);
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  const supabase = createBrowserClient();
  const allTags = await fetchTagsWithStats(supabase);

  // タグ名・description で部分一致フィルタ（DB から全件取って絞るシンプル実装）
  const tags = q
    ? allTags.filter((t) => {
        const needle = q.toLowerCase();
        return (
          t.tagName.toLowerCase().includes(needle) ||
          t.tagId.toLowerCase().includes(needle) ||
          (t.description ?? '').toLowerCase().includes(needle)
        );
      })
    : allTags;

  return (
    <main className="max-w-3xl mx-auto px-3 py-6">
      <header className="mb-4">
        <h1 className="text-[18px] font-semibold">タグ一覧</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          ユーザーの投票で集まったタグを横断的に眺める場所。気になるタグからゲームを辿れる。
        </p>
      </header>

      <div className="mb-4">
        <InlineSearchForm
          action="/tags"
          placeholder="タグ名で絞り込み"
          defaultValue={q}
        />
        {q && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            「{q}」に一致するタグ：{tags.length} 件
          </p>
        )}
      </div>

      <nav className="flex gap-3 border-b border-border mb-4 text-[13px]">
        <TabLink href={q ? `/tags?q=${encodeURIComponent(q)}` : '/tags'} active={view === 'popular'}>
          人気
        </TabLink>
        <TabLink href={q ? `/tags?view=new&q=${encodeURIComponent(q)}` : '/tags?view=new'} active={view === 'new'}>
          新着
        </TabLink>
        <TabLink href={q ? `/tags?view=group&q=${encodeURIComponent(q)}` : '/tags?view=group'} active={view === 'group'}>
          カテゴリ別
        </TabLink>
      </nav>

      {view === 'popular' && <PopularView tags={tags} />}
      {view === 'new' && <NewView tags={tags} />}
      {view === 'group' && <GroupView tags={tags} />}
    </main>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`py-2 -mb-px border-b-2 ${
        active ? 'border-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}

function PopularView({ tags }: { tags: TagStats[] }) {
  const sorted = tags
    .slice()
    .sort((a, b) => b.totalVoteCount - a.totalVoteCount || b.gameCount - a.gameCount);
  return <TagList tags={sorted} emptyText="まだ投票されたタグがありません。" />;
}

function NewView({ tags }: { tags: TagStats[] }) {
  const sorted = tags
    .slice()
    .sort((a, b) => {
      const ax = a.createdAt ?? '';
      const bx = b.createdAt ?? '';
      return bx.localeCompare(ax);
    });
  return <TagList tags={sorted.slice(0, 60)} emptyText="タグがありません。" />;
}

function GroupView({ tags }: { tags: TagStats[] }) {
  const groups = new Map<TagGroup, TagStats[]>();
  for (const t of tags) {
    const arr = groups.get(t.tagGroup) ?? [];
    arr.push(t);
    groups.set(t.tagGroup, arr);
  }
  return (
    <div className="space-y-6">
      {GROUP_ORDER.filter((g) => groups.has(g)).map((g) => {
        const list = (groups.get(g) ?? [])
          .slice()
          .sort((a, b) => b.totalVoteCount - a.totalVoteCount || a.sortOrder - b.sortOrder);
        return (
          <section key={g}>
            <h2 className="text-[14px] font-medium mb-2">{GROUP_LABEL[g]}</h2>
            <TagList tags={list} emptyText="" />
          </section>
        );
      })}
    </div>
  );
}

function TagList({ tags, emptyText }: { tags: TagStats[]; emptyText: string }) {
  if (tags.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-border border-y border-border">
      {tags.map((t) => (
        <li key={t.tagId}>
          <Link
            href={`/tags/${encodeURIComponent(t.tagId)}`}
            className="flex items-center gap-3 px-2 py-2 hover:bg-muted"
          >
            <span
              className={`inline-flex items-center text-[12px] leading-none px-2 py-1 ${
                t.tagType === 'official'
                  ? 'bg-foreground text-background'
                  : 'border border-foreground text-foreground'
              }`}
            >
              {t.tagName}
            </span>
            <span className="text-[12px] text-muted-foreground flex-1 truncate">
              {t.description ?? ''}
            </span>
            <span className="text-[12px] tabular-nums text-muted-foreground shrink-0">
              {t.gameCount}ゲーム / {t.totalVoteCount}票
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
