-- 0005_streaming.sql で作成した配信系テーブルに RLS 読み取り公開ポリシーを追加。
-- パターンは 0001_init.sql / 0003_tags.sql に倣う。書き込みはすべて service role 経由（Next.js サーバー側）。

ALTER TABLE game_streaming_meta     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_slots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_slot_tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_featured_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_share_assets       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read game_streaming_meta" ON game_streaming_meta
  FOR SELECT USING (true);

CREATE POLICY "public read stream_slots" ON stream_slots
  FOR SELECT USING (is_active = true);

CREATE POLICY "public read stream_slot_tags" ON stream_slot_tags
  FOR SELECT USING (true);

-- 公開済み記事のみ read 可
CREATE POLICY "public read stream_featured_articles" ON stream_featured_articles
  FOR SELECT USING (status = 'published');

CREATE POLICY "public read game_share_assets" ON game_share_assets
  FOR SELECT USING (true);
