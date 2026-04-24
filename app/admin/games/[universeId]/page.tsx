import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase';
import type { TagGroup, TagType } from '@/lib/tags';
import { AdminGameTagsClient } from './AdminGameTagsClient';

export const dynamic = 'force-dynamic';

export interface AdminGameTagRow {
  tagId: string;
  tagName: string;
  tagType: TagType;
  tagGroup: TagGroup;
  voteCount: number;
  confidenceScore: number;
  lastVotedAt: string | null;
}

async function fetchGame(universeId: number) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('games')
    .select('universe_id, name, creator_name, place_id')
    .eq('universe_id', universeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchGameTagsForAdmin(universeId: number): Promise<AdminGameTagRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('game_tag_votes')
    .select(
      `tag_id, vote_count, confidence_score, last_voted_at,
       tag_master!inner(tag_id, tag_name, tag_type, tag_group)`
    )
    .eq('universe_id', universeId)
    .order('vote_count', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    vote_count: number;
    confidence_score: number;
    last_voted_at: string | null;
    tag_master: {
      tag_id: string;
      tag_name: string;
      tag_type: TagType;
      tag_group: TagGroup;
    };
  }>;
  return rows.map((r) => ({
    tagId: r.tag_master.tag_id,
    tagName: r.tag_master.tag_name,
    tagType: r.tag_master.tag_type,
    tagGroup: r.tag_master.tag_group,
    voteCount: r.vote_count,
    confidenceScore: r.confidence_score,
    lastVotedAt: r.last_voted_at,
  }));
}

export default async function AdminGameDetailPage({
  params,
}: {
  params: { universeId: string };
}) {
  const universeId = Number(params.universeId);
  if (!Number.isFinite(universeId) || universeId <= 0) notFound();

  const [game, tags] = await Promise.all([
    fetchGame(universeId),
    fetchGameTagsForAdmin(universeId),
  ]);

  if (!game) {
    return (
      <div className="space-y-3 text-[14px]">
        <Link href="/admin/games" className="underline text-[13px]">
          ← ゲーム管理に戻る
        </Link>
        <p className="text-muted-foreground">
          universe {universeId} は DB に存在しません。URL から取得した場合は
          placeId の可能性があります。universeId を直接指定してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[14px]">
      <Link href="/admin/games" className="underline text-[13px]">
        ← ゲーム管理に戻る
      </Link>
      <section>
        <h2 className="text-[15px] font-semibold">{game.name}</h2>
        <p className="text-[12px] text-muted-foreground">
          {game.creator_name ?? '—'} / universe {universeId}
          {game.place_id != null && (
            <>
              {' / '}
              <a
                href={`https://www.roblox.com/games/${game.place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Robloxで開く
              </a>
            </>
          )}
          {' / '}
          <Link href={`/game/${universeId}`} className="underline">
            公開ページ
          </Link>
          {' / '}
          <Link href={`/admin/stream-meta/${universeId}`} className="underline">
            配信メタを編集
          </Link>
        </p>
      </section>

      <AdminGameTagsClient universeId={universeId} initialTags={tags} />
    </div>
  );
}
