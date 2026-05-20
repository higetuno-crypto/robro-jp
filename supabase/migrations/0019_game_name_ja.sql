-- ========================================
-- ゲーム名の日本語表示対応
-- - games に name_ja を追加（Roblox games API の ja-jp ロケール名）
-- - 表示は COALESCE(name_ja, name)。Roblox 公式が日本ロケールで出す名前と統一する。
-- - name は英語/正規名のまま維持する：
--     * detectJapanese（is_japanese 判定）の入力を英語に保つため
--       （翻訳済み名を入れると全ゲームが日本語判定になりトップの「日本で人気」が壊れる）
--     * DB 検索（name.ilike）の英語キーワード照合のため
-- ========================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS name_ja TEXT;
