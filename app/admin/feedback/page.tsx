import { createServiceClient } from '@/lib/supabase';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
} from '@/lib/feedback';
import { AdminFeedbackClient } from './AdminFeedbackClient';

export const dynamic = 'force-dynamic';

export interface AdminFeedbackRow {
  id: number;
  title: string;
  body: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  voteCount: number;
  isHidden: boolean;
  duplicateOf: number | null;
  authorName: string | null;
  createdAt: string;
}

async function fetchAllForAdmin(): Promise<AdminFeedbackRow[]> {
  const supabase = createServiceClient();
  // 管理画面では is_hidden も含めて全件取得
  const { data, error } = await supabase
    .from('feedback_posts')
    .select(
      `id, title, body, category, status, vote_count, is_hidden, duplicate_of, created_at,
       accounts:author_account_id ( display_name )`
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: number;
    title: string;
    body: string;
    category: FeedbackCategory;
    status: FeedbackStatus;
    vote_count: number;
    is_hidden: boolean;
    duplicate_of: number | null;
    created_at: string;
    accounts: { display_name: string | null } | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    status: r.status,
    voteCount: r.vote_count,
    isHidden: r.is_hidden,
    duplicateOf: r.duplicate_of,
    authorName: r.accounts?.display_name ?? null,
    createdAt: r.created_at,
  }));
}

export default async function AdminFeedbackPage() {
  const rows = await fetchAllForAdmin();
  return (
    <AdminFeedbackClient
      initialRows={rows}
      statuses={FEEDBACK_STATUSES}
      categories={FEEDBACK_CATEGORIES}
    />
  );
}
