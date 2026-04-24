import { createServiceClient } from '@/lib/supabase';
import { AdminTagsClient } from './AdminTagsClient';
import type { TagType, TagGroup } from '@/lib/tags';

export const dynamic = 'force-dynamic';

interface AdminTagRow {
  tagId: string;
  tagName: string;
  tagType: TagType;
  tagGroup: TagGroup;
  description: string | null;
  isStreamingRelated: boolean;
  isActive: boolean;
  sortOrder: number;
}

async function fetchAllTagsForAdmin(): Promise<AdminTagRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('tag_master')
    .select(
      'tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, is_active, sort_order'
    )
    .order('tag_group', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    tagId: r.tag_id as string,
    tagName: r.tag_name as string,
    tagType: r.tag_type as TagType,
    tagGroup: r.tag_group as TagGroup,
    description: (r.description as string | null) ?? null,
    isStreamingRelated: r.is_streaming_related as boolean,
    isActive: r.is_active as boolean,
    sortOrder: r.sort_order as number,
  }));
}

export default async function AdminTagsPage() {
  const tags = await fetchAllTagsForAdmin();
  return <AdminTagsClient initialTags={tags} />;
}

export type { AdminTagRow };
