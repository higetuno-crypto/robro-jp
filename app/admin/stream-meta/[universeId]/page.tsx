import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase';
import { fetchStreamingMeta, type StreamingMeta } from '@/lib/streaming';
import { StreamMetaForm } from './StreamMetaForm';

export const dynamic = 'force-dynamic';

async function fetchGame(universeId: number) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('games')
    .select('universe_id, name, creator_name, place_id, thumbnail_url')
    .eq('universe_id', universeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default async function AdminStreamMetaPage(
  props: {
    params: Promise<{ universeId: string }>;
  }
) {
  const params = await props.params;
  const universeId = Number(params.universeId);
  if (!Number.isFinite(universeId) || universeId <= 0) notFound();

  const supabase = createServiceClient();
  const [game, meta] = await Promise.all([
    fetchGame(universeId),
    fetchStreamingMeta(supabase, universeId),
  ]);

  if (!game) {
    return (
      <div className="space-y-3 text-[14px]">
        <Link href="/admin/games" className="underline text-[13px]">
          ← ゲーム管理に戻る
        </Link>
        <p className="text-muted-foreground">
          universe {universeId} は DB に存在しません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[14px]">
      <Link
        href={`/admin/games/${universeId}`}
        className="underline text-[13px]"
      >
        ← ゲーム別タグ管理に戻る
      </Link>
      <section>
        <h2 className="text-[15px] font-semibold">{game.name}</h2>
        <p className="text-[12px] text-muted-foreground">
          配信メタ {meta ? '編集' : '新規作成'} / universe {universeId}
          {' / '}
          <Link href={`/game/${universeId}`} className="underline">
            公開ページ
          </Link>
        </p>
      </section>

      <StreamMetaForm universeId={universeId} initial={meta} />
    </div>
  );
}

export type { StreamingMeta };
