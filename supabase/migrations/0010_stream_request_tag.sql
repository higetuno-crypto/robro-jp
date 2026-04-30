-- ========================================
-- 0010：「配信してほしい」タグを tag_master に追加
--
-- 経緯：
--   3ボタン投票（❤️⭐🔥）に「配信してほしい！」を4つ目として加える案が出たが、
--   既存3ボタンの行動コスト原理（0.5/1.0/2.1）が崩れる・UI 装飾度が増える等の
--   理由で見送り。代わりに既存タグ投票機構で表現する設計に確定（2026-04-30 Yuki判断）。
--
--   参考：idea-evaluation-v4.md §A、CLAUDE.md UI設計原則A
--
-- 設計：
--   tag_type = 'user_selectable'（ユーザーが選ぶ・自由入力ではない）
--   tag_group = 'reaction'（願望表現としてのリアクション）
--   is_streaming_related = TRUE（/stream ハブや stream-meta 集計に活用可能）
--
-- 用途：
--   ・ゲーム詳細でユーザーが「このゲーム配信してほしい」と意思表明できる
--   ・/tags/stream_request で集計閲覧
--   ・将来、/stream で「配信リクエスト多いゲーム」コーナーに集計流用
-- ========================================

INSERT INTO tag_master (tag_id, tag_name, tag_type, tag_group, description, is_streaming_related, is_active, sort_order)
VALUES (
  'stream_request',
  '配信してほしい',
  'user_selectable',
  'reaction',
  '配信者にこのゲームを配信してほしい、という視聴者・ファンからの意思表明',
  TRUE,
  TRUE,
  100
)
ON CONFLICT (tag_id) DO NOTHING;
