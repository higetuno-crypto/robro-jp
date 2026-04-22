# Roblox Japan Ranking (roblo.fortunep.net)

## 目次

1. [このドキュメントの使い方](#このドキュメントの使い方)
2. [プロジェクト概要](#プロジェクト概要)
3. [ビジョン](#ビジョン設計判断の基準)
4. [UI設計原則](#ui設計原則最優先--迷ったらここに戻る)
5. [技術スタック](#技術スタック確定事項--逸脱しない)
6. [ディレクトリ構造](#ディレクトリ構造)
7. [DBスキーマ](#dbスキーマsupabase--postgresql)
8. [拡張設計ガイドライン](#拡張設計ガイドライン絶対原則)
9. [フェーズ分割](#フェーズ分割必ず順番に実装)
10. [コーディング規約](#コーディング規約)
11. [外部API注意事項](#外部api使用上の注意)
12. [やらないこと](#やらないことスコープ外)
13. [質問・確認ルール](#質問確認)
14. [現在のフェーズ](#現在のフェーズ)

---

## このドキュメントの使い方

- **タスク開始時**：目次から該当セクションに飛ぶ。全文読み直しは不要
- **迷った時**：UI設計原則 と 拡張設計ガイドライン を最優先で参照
- **スキーマ変更時**：必ず確認を取る（勝手に進めない）
- **新機能追加時**：拡張設計ガイドラインに沿っているか検証

---

## プロジェクト概要

日本語圏向けのRobloxゲーム発見プラットフォーム。Roblox公式検索では埋もれがちな個人開発ゲームを含め、リアルタイムのCCU（同時接続数）ランキングを提供する。将来的には個人開発者の登録・プロモーション機能、宣伝ポイント経済を構築予定。

**MVPのゴール**：プレイヤー向けランキングサイトを最速でローンチし、トラフィックを蓄積する。

---

## ビジョン（設計判断の基準）

- **面白さの通訳（コア差別化）**：他サイト（Rolimons、RoMonitor、robloxgame.jp）は「人気ゲームの数値比較」で勝負している。robro-jp は**数字の翻訳ではなく、"何が面白いか・誰向けか・英語不要か・配信向きか"を日本語で翻訳するサイト**としてポジションを取る。ランキングサイトではなく「日本人向け Roblox 発見サイト」。
- **日本語ファースト**：UI・デフォルト並び順・コピーライティング全てを日本語ユーザー中心に据える。公式Chartsの `country=JP` フィルタは認証必須で匿名APIからは使えないため、**`is_japanese` 判定を一次シグナル**として「日本で人気」を構築
- **運営解説 + ユーザー集合知のハイブリッド**：運営が日本語一言ピッチを与え、その上に**ユーザー投票タグ**（選択式、自由入力は初期は不可）を重ねて意味付け。ニコニコのタグ文化を参考
- **配信者ファースト導線**：配信者／インフルエンサーが「紹介しやすい」「企画が作れる」「OG画像が映える」状態を作れば、外部SNSからの流入ハブ（ro-bro は紹介される側ではなく、紹介に使われる側）になれる
- **軽量・高速**：初回表示1秒以内。モバイル最優先
- **誠実な数字**：Rolimonsのコピーではなく、自前で時系列を貯めて独自の「急上昇」を出す
- **将来のJP実データ取得**：認証cookie運用（使い捨てアカウント）や、ブラウザヘッドレスでの取得は将来検討
- **拡張を前提**：**将来の機能（タグ職人ランキング、配信者アカウント、開発者登録、宣伝ポイント）を最初から構造に織り込む**

---

## UI設計原則（最優先 / 迷ったらここに戻る）

このサイトは**5種類**のページで構成される。それぞれUI思想が違う。**絶対に混ぜない**。

### A. ランキングページ（/, /trending, /categories, /new, /global）

**思想：事実を淡々と提示する。編集者の意図を一切混ぜない。ニコニコ動画のランキングページが手本。**

- 1位も100位も**同じ行の高さ・同じフォントサイズ・同じサムネサイズ**
- 順位バッジは1〜3位のみ色差（金・銀・銅）OK、ただし**サイズは同一**
- 1行のカラム構成固定：`[順位] [サムネ60×60] [タイトル+開発者] [CCU] [変動]`
- 装飾禁止：影、グラデーション、ホバーアニメーション、派手なアイコンNG
- フォントサイズは2種類まで：タイトル（14px）、数値（14px tabular-nums）
- 変動だけ色差OK：↑緑、↓赤、NEW青バッジ
- 更新時刻常時表示：「3分前更新」
- 参考UI：**Yahoo!リアルタイム検索、価格.comランキング、ニコニコ動画ランキング、Googleトレンド**

### B. ピックアップページ（/featured）

**思想：編集者（Yuki）の主観で推す。熱量を出していい場所。**

- カードベース、大きいサムネ、キャッチコピーOK
- 1枚ごとに一言コメント（推薦理由）を必ず入れる
- 装飾・装丁のバリエーションOK
- 手動更新（Supabaseダッシュボードから直接編集）
- ランキングページとは**明確に別物**に見える見た目

### C. 配信者ページ（/stream, /stream/[slot]）

**思想：配信者／インフルエンサーが「今夜の配信ネタ」を5秒で選べる専用ハブ。詳細ページとも事実ベースのランキングとも分離する。**

- トップ `/stream` は用途別スロットのカードグリッド（collab / viewer / short / reaction / no-english / loud の6枠、DB駆動化は将来）
- `/stream/[slot]` は該当タグを持つゲーム一覧。カードには配信向けバッジ最大3つ、英語ハードルを一目で表示
- 並び順：`confidence_score DESC, editorial_score_stream DESC, vote_count DESC`
- 詳細ページ（`/game/[universeId]`）には `StreamMetaPanel` を**条件付きで**埋め込む（`game_streaming_meta` 行が存在するゲームだけ）。一言ピッチ、配信向けポイント3つ、FitMatrix（ソロ/コラボ/視聴者参加/切り抜きの4軸）、最初の10分、今なぜ配信向きか、注意点（英語依存度・BGM・年齢感・チャット露出）
- 各ゲームに **シェアカード（OG画像）** を `next/og` で動的生成：日本語一言ピッチ＋配信バッジ最大3＋英語ハードル。Xシェアの標準ツールに
- 文言ルール厳守：「安全に配信できます」「著作権的に問題ありません」「絶対バズる」「クソゲー」等は**禁止**。管理画面でワードチェッカを発動

### D. タグページ（/tags, /tags/[slug]）

**思想：ユーザー集合知を集約・閲覧するための場所。ランキングでもピックアップでもない第3の発見軸。**

- タグは3層構造：**公式タグ**（運営付与・骨格）／**ユーザー推薦タグ**（プールから選択式・空気感）／自由入力はMVPでは封印
- `/tags` はタグ一覧（人気／新着／カテゴリ別）
- `/tags/[slug]` はタグ詳細＋紐づくゲーム一覧（得票順）＋そのタグを多く付けた「タグ職人」枠＋関連タグ
- 詳細ページにも `TagCloud` を埋め込み：公式は塗り、ユーザーは枠線、得票数に応じて濃淡
- 「タグを付ける」ボタン → `TagPickerModal`（最大5件・選択式のみ）。未ログイン時はログイン誘導
- ネガティブ表現は辞書で置換：「クソゲー」→「好み分かれる」、「治安終わってる」→「治安に波あり」
- タグ職人文化：ユーザーの `tagContributionScore` を日次バッチで更新。採用バッジ（公式採用／急上昇／配信者支持）で動機づけ

### E. 宣伝ページ（/promoted、フェーズ8以降）

**思想：ゲーム開発者が有償で獲得した露出枠。「誰がいくら払ったか」を可視化することで信頼性を担保する。**

- ピックアップより機能的・一覧的
- 宣伝の種別（ユーザー宣伝 / 企業宣伝）を明示
- 消費ポイントと期間を明示（ステルスマーケティング回避）
- ランキングは細分化可能：少額多数 / 高額少数 / 企業のみ / ユーザーのみ

### ナビゲーション階層（絶対に混ぜない）

```
ヘッダー：[ランキング] [配信] [タグ] [ピックアップ] [宣伝]
             ↑フェーズ1-3  ↑フェーズ7  ↑フェーズ6  ↑フェーズ5  ↑フェーズ8以降
  ├─ ランキング配下タブ：
  │     [日本で人気]（/ デフォルト）
  │     [日本の急上昇]（/trending）
  │     [カテゴリ別]（/categories）
  │     [今週の新着]（/new）
  │     [全世界総合]（/global）
  ├─ 配信：
  │     /stream（ハブ：用途別スロットカード）
  │     /stream/[slot]（collab/viewer/short/reaction/no-english/loud）
  ├─ タグ：
  │     /tags（人気／新着／カテゴリ別）
  │     /tags/[slug]（タグ詳細＋ゲーム一覧＋タグ職人）
  ├─ ピックアップ：
  │     /featured（一覧）
  │     /featured/[slug]（今週の配信ネタ記事）← フェーズ7で拡張
  └─ 宣伝：配下タブ [総合] [企業] [ユーザー] [新着] など（フェーズ8以降）
```

**重要**：ルート `/` は「日本で人気」。「全世界総合」は `/global` に格下げ。日本ユーザーが最初に見るのは日本で人気のゲーム。

タブに異種を混ぜない。階層を上げて分離する。

---

## 技術スタック（確定事項 / 逸脱しない）

| レイヤー | 採用 |
|---|---|
| フロントエンド | Next.js 14 (App Router) + TypeScript |
| スタイル | Tailwind CSS + shadcn/ui |
| グラフ | Recharts |
| DB | Supabase (PostgreSQL) |
| データ取得ジョブ | Vercel Cron (初期) → 負荷増大で n8n 移行 |
| データソース（主） | Roblox公式 explore-api（`get-sort-content`）：`top-playing-now` / `top-trending` / `up-and-coming` / `top-revisited` などの全世界ソートをunionして上位500件を取得 |
| データソース（補） | Roblox公式 games/v1 API（詳細・CCU詳細）、Roblox公式 thumbnails API |
| 日本ゲーム抽出 | `japanese-detector.ts`（タイトル・説明の日本語スコア）。country=JP フィルタは認証必須で使えないため、この判定でJP向けゲームを近似 |
| ホスティング | Vercel (東京リージョン) |
| ドメイン | roblo.fortunep.net |

**採用しない**：Redis、WebSocket、SSE、Prisma（Supabase client直で十分）

---

## ディレクトリ構造

```
roblo-jp/
├── CLAUDE.md
├── app/
│   ├── layout.tsx                    # ヘッダーナビ
│   ├── (ranking)/
│   │   ├── layout.tsx                # ランキング配下タブ
│   │   ├── page.tsx                  # / 日本で人気（デフォルト）
│   │   ├── trending/page.tsx         # /trending 日本の急上昇
│   │   ├── categories/
│   │   │   ├── page.tsx              # /categories カテゴリ一覧
│   │   │   └── [slug]/page.tsx       # /categories/roleplay など
│   │   ├── new/page.tsx              # /new 今週の新着
│   │   └── global/page.tsx           # /global 全世界総合
│   ├── featured/
│   │   ├── page.tsx                  # /featured ピックアップ一覧
│   │   └── [slug]/page.tsx           # /featured/[slug] 今週の配信ネタ記事（フェーズ7）
│   ├── stream/                       # フェーズ7：配信者導線
│   │   ├── page.tsx                  # /stream ハブ
│   │   └── [slot]/page.tsx           # /stream/collab など
│   ├── tags/                         # フェーズ6：タグ機能
│   │   ├── page.tsx                  # /tags 一覧
│   │   └── [slug]/page.tsx           # /tags/[slug] タグ詳細
│   ├── promoted/                     # フェーズ8以降
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # /promoted 総合宣伝
│   │   ├── company/page.tsx          # /promoted/company 企業宣伝
│   │   └── user/page.tsx             # /promoted/user ユーザー宣伝
│   ├── game/[universeId]/page.tsx
│   └── api/
│       └── cron/
│           └── fetch-games/route.ts
├── lib/
│   ├── supabase.ts
│   ├── roblox-api.ts                 # games/v1 詳細取得
│   ├── roblox-charts.ts              # 公式Charts スクレイピング（country=JP / 全世界）
│   ├── rolimons-api.ts               # 全世界上位リスト補完用（従属）
│   ├── japanese-detector.ts
│   ├── tags.ts                       # フェーズ6：タグ集計・confidence_score計算
│   ├── streaming.ts                  # フェーズ7：stream-metaヘルパー・文言チェッカ
│   ├── og.ts                         # フェーズ7：OG画像生成ヘルパー
│   ├── validators/                   # zod スキーマ
│   │   ├── streamMeta.ts
│   │   └── tagVote.ts
│   └── promotion/                    # フェーズ8以降
│       ├── pricing.ts                # 料金計算
│       └── ranking.ts                # 宣伝ランキングのクエリ生成
├── components/
│   ├── RankingRow.tsx                # 全順位共通の1行
│   ├── FeaturedCard.tsx
│   ├── tag/                          # フェーズ6
│   │   ├── TagBadge.tsx              # variant: official | community
│   │   ├── TagCloud.tsx
│   │   └── TagPickerModal.tsx
│   ├── stream/                       # フェーズ7
│   │   ├── StreamEntryBlock.tsx      # トップ `/` 配信入口
│   │   ├── StreamSlotCard.tsx
│   │   ├── StreamBadge.tsx
│   │   ├── StreamMetaPanel.tsx       # 詳細ページ埋め込み
│   │   ├── StreamFitMatrix.tsx
│   │   ├── StreamCautionList.tsx
│   │   ├── FirstTenMinutesBox.tsx
│   │   ├── WhyNowPopularBox.tsx
│   │   └── ShareCardButton.tsx
│   ├── PromotedRow.tsx               # フェーズ8以降
│   └── TrendChart.tsx
├── types/
│   └── game.ts
└── scripts/
    └── seed-universe-ids.ts
```

---

## DBスキーマ（Supabase / PostgreSQL）

**必ずこのスキーマを守る。変更時は必ず確認を取る。**

### フェーズ1-5で使うテーブル

```sql
-- ゲームマスタ
CREATE TABLE games (
  universe_id BIGINT PRIMARY KEY,
  place_id BIGINT,
  name TEXT NOT NULL,
  description TEXT,
  creator_name TEXT,
  creator_type TEXT,          -- 'User' or 'Group'
  thumbnail_url TEXT,
  is_japanese BOOLEAN DEFAULT FALSE,
  japanese_score REAL DEFAULT 0,
  -- カテゴリ（Roblox 詳細API由来）
  genre_l1 TEXT,               -- 表示用：'Roleplay & Avatar Sim' など
  genre_slug TEXT,             -- URL用：'roleplay_and_avatar_sim' など
  -- 将来の拡張用：開発者登録機能で使う
  owner_account_id BIGINT,    -- accountsテーブルへのFK（フェーズ6以降）
  is_verified_by_us BOOLEAN DEFAULT FALSE,  -- 自前認証
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_games_is_japanese ON games(is_japanese);
CREATE INDEX idx_games_updated_at ON games(updated_at);
CREATE INDEX idx_games_owner ON games(owner_account_id);
CREATE INDEX idx_games_first_seen_at ON games(first_seen_at DESC);  -- 今週の新着用
CREATE INDEX idx_games_genre_slug ON games(genre_slug);              -- カテゴリ別ランキング用

-- 時系列スナップショット（CCU等の数値）
CREATE TABLE game_snapshots (
  universe_id BIGINT REFERENCES games(universe_id),
  captured_at TIMESTAMPTZ NOT NULL,
  playing INT NOT NULL,
  visits BIGINT,
  favorites BIGINT,
  PRIMARY KEY (universe_id, captured_at)
);
CREATE INDEX idx_snapshots_captured_at ON game_snapshots(captured_at DESC);

-- NOTE: 当初 chart_rankings テーブルで source 別に保存する設計だったが、
-- explore-api にカテゴリ別 sort がなく、代わりに games.genre_l1 / genre_slug（Roblox詳細API由来）
-- でカテゴリ分類できることが判明したため、chart_rankings テーブルは不要になった。
-- ランキングはすべて game_snapshots + games の WHERE 条件で表現する：
--   全世界総合  : games 全件、playing 降順
--   日本で人気  : games.is_japanese = true、playing 降順
--   急上昇      : 前スナップショットとの playing 比率
--   カテゴリ別  : games.genre_slug = '<slug>'、playing 降順
--   今週の新着  : games.first_seen_at >= now() - '7 days'、playing 降順

-- ピックアップ（編集者手動）
CREATE TABLE featured_games (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT REFERENCES games(universe_id),
  headline TEXT NOT NULL,
  comment TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  featured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_featured_active ON featured_games(is_active, display_order);
```

### フェーズ6：タグ機能で使うテーブル

**設計原則**：拡張設計ガイドライン#1（イベントログ型）・#3（TEXT + CHECK）を順守。自由入力タグはMVPでは受け付けず、`tag_master` からの選択式のみ。

```sql
-- タグマスタ（公式タグ・ユーザー選択式タグプール）
CREATE TABLE tag_master (
  tag_id TEXT PRIMARY KEY,              -- 'collab_good' など英小文字slug
  tag_name TEXT NOT NULL,               -- 表示名「コラボ向き」
  tag_type TEXT NOT NULL CHECK (tag_type IN ('official','user_selectable','free')),
  tag_group TEXT NOT NULL CHECK (tag_group IN ('format','reaction','participation','caution','difficulty','vibe','genre')),
  description TEXT,
  is_streaming_related BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_tag_active ON tag_master(is_active, sort_order);
CREATE INDEX idx_tag_streaming ON tag_master(is_streaming_related) WHERE is_streaming_related = TRUE;

-- タグ投票集計（ゲーム×タグの一意、vote_countはトリガで更新）
CREATE TABLE game_tag_votes (
  universe_id BIGINT REFERENCES games(universe_id) ON DELETE CASCADE,
  tag_id TEXT REFERENCES tag_master(tag_id) ON DELETE CASCADE,
  vote_count INT NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,  -- min(1, vote_count / (vote_count + K)), K=10
  last_voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (universe_id, tag_id)
);
CREATE INDEX idx_gtv_universe ON game_tag_votes(universe_id);
CREATE INDEX idx_gtv_tag_conf ON game_tag_votes(tag_id, confidence_score DESC);

-- 投票生ログ（イベントログ型。荒らし検知・取り消し・職人スコア算定に使う）
CREATE TABLE game_tag_vote_logs (
  id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL,
  tag_id TEXT NOT NULL,
  account_id BIGINT,                   -- ログインユーザー（phase6でaccounts稼働時）
  fingerprint TEXT NOT NULL,           -- IP hash + UA hash（匿名投票の重複防止）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gtvl_fp_time ON game_tag_vote_logs(fingerprint, created_at DESC);
CREATE INDEX idx_gtvl_account ON game_tag_vote_logs(account_id) WHERE account_id IS NOT NULL;

-- タグ職人スコア（日次バッチで再計算、拡張ガイドライン#5：RPC/Viewで集計）
-- accounts.tag_contribution_score カラムに書き戻す想定（accounts テーブル稼働後）
```

**レートリミット（アプリ層で実装）**：
- 1 fingerprint × 1 (game_id, tag_id) = 24h内1票
- 1 fingerprint = 60秒20票、1日50票
- 違反は 429

### フェーズ7：配信者導線で使うテーブル

```sql
-- ゲーム別・配信メタ情報（運営が手動で入れる。Supabase管理画面 or /admin 画面から）
CREATE TABLE game_streaming_meta (
  universe_id BIGINT PRIMARY KEY REFERENCES games(universe_id) ON DELETE CASCADE,
  short_pitch_ja TEXT NOT NULL,              -- 5〜60字：一言でいうと
  stream_summary_ja TEXT NOT NULL,           -- 10〜200字
  stream_points JSONB NOT NULL DEFAULT '[]', -- 最大3件の配信ポイント
  solo_fit TEXT NOT NULL CHECK (solo_fit IN ('high','mid','low')),
  collab_fit TEXT NOT NULL CHECK (collab_fit IN ('high','mid','low')),
  viewer_participation_fit TEXT NOT NULL CHECK (viewer_participation_fit IN ('high','mid','low')),
  clip_fit TEXT NOT NULL CHECK (clip_fit IN ('high','mid','low')),
  english_barrier TEXT NOT NULL CHECK (english_barrier IN ('low','mid','high')),
  learning_curve TEXT NOT NULL CHECK (learning_curve IN ('easy','normal','hard')),
  first_10min_guide TEXT NOT NULL DEFAULT '',
  why_now_popular TEXT NOT NULL DEFAULT '',
  stream_caution_notes JSONB NOT NULL DEFAULT '[]',  -- [{id,label,body,severity}]
  recommended_party_size TEXT NOT NULL DEFAULT '',
  average_session_length TEXT NOT NULL DEFAULT '',
  share_card_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  editorial_score_stream INT NOT NULL DEFAULT 0 CHECK (editorial_score_stream BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gsm_editorial ON game_streaming_meta(editorial_score_stream DESC);

-- 配信用途スロット（/stream/[slot] のマスタ。固定でコードに持たず、ここに置く = 拡張ガイドライン#2）
CREATE TABLE stream_slots (
  slot_key TEXT PRIMARY KEY,           -- 'collab','viewer','short','reaction','no-english','loud'
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- スロット→タグのマッピング（1対N）
CREATE TABLE stream_slot_tags (
  slot_key TEXT REFERENCES stream_slots(slot_key) ON DELETE CASCADE,
  tag_id TEXT REFERENCES tag_master(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (slot_key, tag_id)
);

-- 特集記事（「今週の配信ネタ」。featured_games は単発ピックアップ、こちらは記事型）
CREATE TABLE stream_featured_articles (
  article_id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- /featured/[slug]
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  eyecatch_text TEXT,
  featured_universe_ids JSONB NOT NULL DEFAULT '[]',   -- [BIGINT...]
  status TEXT NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sfa_status_pub ON stream_featured_articles(status, published_at DESC);

-- シェアカードキャッシュ（OG画像の生成結果をバージョン管理。任意）
CREATE TABLE game_share_assets (
  asset_id BIGSERIAL PRIMARY KEY,
  universe_id BIGINT NOT NULL REFERENCES games(universe_id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('og_image','share_card')),
  image_url TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**slot → tag 初期マッピング**（`stream_slot_tags` シード）：
```
collab      → collab_good, voice_chat_plus
viewer      → viewer_join, scale_up
short       → short_play, easy_rule
reaction    → reaction_good, loud_fun
no-english  → no_english, easy_rule
loud        → loud_fun, reaction_good
```

**公式配信タグ初期シード**（`tag_master` の `is_streaming_related=TRUE`）：
```
stream_good(配信映え), collab_good(コラボ向き), solo_ok(ソロでもいける),
viewer_join(視聴者参加向き), short_play(短時間向き), long_play(長時間向き),
reaction_good(初見リアクション), loud_fun(叫ぶ系), slow_burn(じわじわ沼る),
no_english(英語ほぼ不要), easy_rule(ルール簡単), voice_chat_plus(通話あり推奨),
scale_up(人数いると化ける)
```

**文言モデレーション**：管理画面での入力時、以下は保存前にブロック：
- 禁止：「安全に配信できます」「著作権的に問題ありません」「絶対バズる」「クソゲー」「ガキ向け」「治安終わってる」
- 置換推奨：クソゲー→好み分かれる／ガキ向け→年齢層低めの印象／絶対バズる→配信映えしやすい

### フェーズ8以降で使うテーブル（設計だけ先に固める）

**以下は実装しない。ただし、上記のフェーズ1-5スキーマに外部キー `owner_account_id` を予約しておくことで、後でこのテーブル群を追加しても既存データが壊れない。**

```sql
-- アカウント（将来の開発者/企業登録）
CREATE TABLE accounts (
  id BIGSERIAL PRIMARY KEY,
  account_type TEXT NOT NULL,         -- 'user' | 'company'
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  roblox_user_id BIGINT,              -- 本人確認用
  points_balance BIGINT DEFAULT 0,    -- 保有宣伝ポイント
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 宣伝枠マスタ（種別・単価をテーブル化）
-- 新しい枠を追加したい時はコード修正ではなくこのテーブルにINSERTするだけ
CREATE TABLE promotion_slots (
  id BIGSERIAL PRIMARY KEY,
  slot_key TEXT UNIQUE NOT NULL,       -- 'top_banner' | 'sidebar' | 'promoted_list' など
  display_name TEXT NOT NULL,
  base_price_per_day INT NOT NULL,     -- ポイント/日
  max_concurrent INT DEFAULT 1,        -- 同時掲載可能数
  is_active BOOLEAN DEFAULT TRUE
);

-- 宣伝トランザクション（イベントログ型）
-- すべての宣伝行為を1行=1イベントで記録。集計はクエリ側で行う
CREATE TABLE promotion_transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id),
  universe_id BIGINT REFERENCES games(universe_id),
  slot_id BIGINT REFERENCES promotion_slots(id),
  points_spent BIGINT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_promo_universe ON promotion_transactions(universe_id);
CREATE INDEX idx_promo_account ON promotion_transactions(account_id);
CREATE INDEX idx_promo_active ON promotion_transactions(starts_at, ends_at);

-- 料金・レート設定（ハードコード禁止、ここに集約）
CREATE TABLE pricing_config (
  key TEXT PRIMARY KEY,                -- 'jpy_per_point' | 'min_purchase' など
  value_numeric NUMERIC,
  value_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 宣伝ランキングは「View」で実現する

細分化ランキング（少額多数/高額少数/企業/ユーザー）はすべて `promotion_transactions` への**クエリの違い**で表現する。新ランキングを足したくなったらテーブル追加ではなくクエリ追加で済む。

```sql
-- 例：高額少数ランキング（1件あたりの平均単価が高い順）
-- 例：少額多数ランキング（トランザクション数が多い順）
-- 例：企業宣伝ランキング（account_type = 'company' のみ集計）
-- すべて promotion_transactions + accounts + games のJOINで出る
```

---

## 拡張設計ガイドライン（絶対原則）

**新機能を追加する時、以下の原則を逸脱しそうになったら必ず停止して確認。**

### 1. イベントログ型を基本とする

- ユーザー行動・宣伝行為・ポイント消費などは**1行=1イベント**で記録
- 集計値は保存しない（毎回クエリで計算）
- 理由：後から集計軸を増やしても既存データが使える

### 2. マスタデータのテーブル化

- 以下はコードに書かない：
  - 料金、ポイントレート、宣伝枠の種類、プラン名、カテゴリ
- すべて対応する `*_config` または `*_slots` テーブルに持たせる
- 理由：値の変更にデプロイ不要

### 3. 列挙型はTEXTで持つ

- `account_type`、`slot_key` などはENUMではなくTEXT + CHECK制約
- 理由：PostgreSQLのENUMは後から値を追加するのがDDL必要で面倒

### 4. 外部キーは予約しておく

- フェーズ1で作ったテーブルにも、将来のテーブルへのFK列を予約する
- `games.owner_account_id` は今は常にNULLだが、列だけ用意しておく
- 理由：後で列追加すると既存行の扱いが煩雑

### 5. 集計ランキングはViewまたはRPCで

- アプリ側で複雑なSQLを書かず、Supabase側にViewやRPC（Stored Procedure）として定義
- 理由：クエリロジックの差し替えがDB側で完結する

### 6. 機能フラグの活用

- 未リリース機能はコードを入れても `NEXT_PUBLIC_FEATURE_PROMOTION=false` でUIから隠す
- 理由：段階的リリースとA/Bテストが可能

### 7. URL構造の一貫性

- カテゴリ分類のあるページは `/{category}/{subcategory}/` 形式で統一
- 例：`/promoted/company`、`/promoted/user`、`/promoted/high-value`
- 理由：SEOとUXの両方で予測可能な構造になる

---

## フェーズ分割（必ず順番に実装）

各フェーズの完了時に git commit。

### フェーズ0：プロジェクト初期化
**ゴール**：Next.jsが起動し、Supabaseに接続できる。

- [ ] Next.js + TS + Tailwind + App Router
- [ ] shadcn/ui init
- [ ] `@supabase/supabase-js` 導入
- [ ] `.env.local` 作成
- [ ] `lib/supabase.ts` でブラウザ用・サーバー用分離
- [ ] `/` にダミーテキスト表示

**完了条件**：`pnpm dev` で localhost:3000 が表示される。

### フェーズ1：データ取得パイプライン
**ゴール**：5〜10分ごとに「日本Chart」「全世界Chart」「カテゴリ別Chart」のUniverseIdと順位、およびCCUが蓄積される。

- [x] `lib/roblox-explore-api.ts`：公式 explore-api を叩き、複数sort（top-playing-now / top-trending / up-and-coming / top-revisited / カテゴリ別sort）をunionしてUniverseIdを取得
  - **調査済み制約**：`country=JP` 相当のフィルタは匿名アクセスでは効かない（filter値は常に `all`）。日本ゲームは `is_japanese` 判定で近似
- [ ] `lib/roblox-api.ts`：games/v1 でCCU/詳細を100件ずつ取得、バッチ間500msディレイ
- [ ] `lib/rolimons-api.ts`：全世界上位リスト補完用（Charts取得が失敗した時のフォールバック）
- [ ] `lib/japanese-detector.ts`：ルールベース判定
- [ ] `app/api/cron/fetch-games/route.ts`：Charts取得 → 重複除去したUniverseIdでRoblox詳細取得 → `games` upsert + `game_snapshots` insert + `chart_rankings` insert
- [ ] `CRON_SECRET` でBearer認証
- [ ] `vercel.json` に `"*/10 * * * *"`

**完了条件**：手動叩きで `chart_rankings` に `source='official_jp'` と `'official_global'` の行が両方入る。2回目で重複エラーなし。

### フェーズ2：日本で人気ランキング（デフォルト）
**ゴール**：`/` に公式Charts(country=JP)の最新順位トップ100を表示。

- [ ] `(ranking)/layout.tsx`：タブナビ（日本で人気 / 急上昇 / カテゴリ / 新着 / 全世界）
- [ ] `(ranking)/page.tsx`：`chart_rankings` の最新 `source='official_jp'` をJOIN
- [ ] `components/RankingRow.tsx`：全順位で見た目同じ
- [ ] モバイル縦リスト、デスクトップテーブル
- [ ] 更新時刻表示
- [ ] `revalidate = 300`

**完了条件**：1位と100位の見た目が順位バッジ以外同じ。URLが `/` でJP Chartsが表示される。

### フェーズ3：急上昇・カテゴリ別・今週の新着・全世界
**ゴール**：5種類のランキング。**同じ `RankingRow` を使い回す**。

- [ ] `/trending`：日本Chartsの順位変動（前回captureからのrank差分、新規=NEWバッジ）
- [ ] `/categories`：カテゴリ一覧（公式Chartsのカテゴリslug列挙、テーブル化：`category_slots` などにマスタを置く）
- [ ] `/categories/[slug]`：`source='official_category:<slug>'` で絞り込み
- [ ] `/new`：`games.first_seen_at >= now() - interval '7 days'` を playing 降順で
- [ ] `/global`：`source='official_global'` の最新順位

**完了条件**：5URLで並び順が異なる。行の見た目は全ページ同一。

### フェーズ4：個別ゲームページ
**ゴール**：詳細+24時間CCU推移グラフ。

- [ ] `/game/[universeId]`
- [ ] Recharts LineChart（直近24時間、5分刻み）
- [ ] 公式Robloxへの遷移ボタン

**完了条件**：ランキングから遷移可、グラフ描画OK。

### フェーズ5：ピックアップページ
**ゴール**：Yukiが手動で選んだ推しを掲載。

- [ ] `/featured`：`featured_games` JOIN
- [ ] `components/FeaturedCard.tsx`：カード型
- [ ] ヘッダーに「ピックアップ」追加
- [ ] トップページ上部にミニセクション+導線

**完了条件**：Supabaseで行追加すれば即反映。

### フェーズ6：タグ機能（MVP1）
**ゴール**：公式タグが全ゲームに付き、ログインユーザーがプールから選んで投票できる。詳細ページでタグが見える。

**優先度**：宣伝より先にこれを実装する。ro-bro の差別化の中核は「日本語の通訳」であり、タグはその中核要素。

- [ ] スキーマ：`tag_master` / `game_tag_votes` / `game_tag_vote_logs` / `accounts`（最小＝ログインのみ）
- [ ] シード：公式タグ + ユーザー選択式タグプール（higesakusei/新しい方向性/タグ仕様書.txt のシード表に準拠）
- [ ] API：`GET /api/games/[id]/tags` / `POST /api/games/[id]/tags`（選択式・最大5件・レートリミット）
- [ ] コンポーネント：`TagBadge` / `TagCloud` / `TagPickerModal`
- [ ] 詳細ページ上部改修：一言ピッチ → 公式タグ → 人気ユーザータグ → 「タグを付ける」ボタン
- [ ] `/tags`（人気/新着/カテゴリ別）、`/tags/[slug]`
- [ ] トップ「目的別で選ぶ」セクション（初めてのRobloxならこれ／英語ほぼ不要／友達向け等）
- [ ] モデレーション：選択式のみ受け付け、レートリミット、ネガティブ表現辞書
- [ ] 管理画面：タグ管理・ゲーム別割り当て
- [ ] OPS：`tag_contribution_score` 日次バッチ（タグ職人）

**完了条件**：任意のゲーム詳細ページでタグ投票ができ、`/tags/collab_good` で該当ゲーム一覧が表示される。

### フェーズ7：配信者導線（MVP1）
**ゴール**：配信者が `/stream` から「今夜のネタ」を選び、詳細ページの StreamMetaPanel と OG シェア画像で紹介コピーに困らない。

- [ ] スキーマ：`game_streaming_meta` / `stream_slots` / `stream_slot_tags` / `stream_featured_articles`
- [ ] 手動入力：10本のゲームに `game_streaming_meta` を投入（Sprint 1相当）
- [ ] API：`GET /api/games/[id]/stream-meta`、`GET /api/stream/slots/[slot]`、`GET/POST /api/featured`
- [ ] 詳細ページ：`StreamMetaPanel`（存在する時だけ表示）。FitMatrix / CautionList / FirstTenMinutesBox / WhyNowPopularBox / ShareCardButton
- [ ] `/stream`（ハブ）、`/stream/[slot]`（6スロット）
- [ ] `/featured/[slug]`（今週の配信ネタ記事、1本公開）
- [ ] OG画像：`/api/og/game/[id]`、`/api/og/featured/[slug]`（`next/og` で1200x630）
- [ ] 計測：`stream_entry_click` 等の9イベント（higesakusei/配信者導線.txt §9.1）
- [ ] トップページに `StreamEntryBlock`（6スロットカード）追加

**完了条件**：`/stream/collab` で該当ゲームが並び、詳細ページの配信ブロックが出て、OG画像がX共有で映える。

### フェーズ8以降（宣伝機能、設計のみ）

以下はフェーズ6-7が運用に乗ってから着手。**設計段階でフェーズ1-5のスキーマには既に布石を打ってある**ので、既存データを壊さず追加できる。

- **フェーズ8**：アカウント登録強化（accounts 本格運用、Roblox本人確認フロー）
- **フェーズ9**：ポイント購入・保有（Stripe連携、pricing_config活用）
- **フェーズ10**：宣伝枠購入（promotion_slots、promotion_transactions）
- **フェーズ11**：宣伝ページ `/promoted` と配下タブ
- **フェーズ12**：宣伝ランキング細分化（SQL View追加で実現）

---

## コーディング規約

- **TypeScript strict mode必須**
- Server Componentデフォルト、Client Componentは必要時のみ `'use client'`
- Supabase型は `supabase gen types typescript` で自動生成
- エラーは握りつぶさず `console.error`
- `any` 禁止、`unknown` で絞り込む
- 日本語コメント推奨（設計意図は日本語で残す）
- **各フェーズ完了時に git commit**
- **マジックナンバー禁止**：料金・閾値は `pricing_config` テーブルまたは定数ファイルに

---

## 外部API使用上の注意

- 公式 explore-api（主ソース）：`apis.roblox.com/explore-api/v1/get-sort-content`。1 sort あたり ~90件。複数sortをunionして500件を構築。10分に1回程度。User-Agent付与
  - 使うsortId：`top-playing-now` / `top-trending` / `up-and-coming` / `top-revisited`、および将来のカテゴリsort
  - `country_filter_v3` パラメータは匿名では反映されない（確認済）
- Rolimons API：1分に1〜2回まで（フォールバック用途）
- Roblox公式API（games/v1）：UniverseId 100件/req、バッチ間500ms
- プロキシ禁止（rprxy.xyz等）
- サムネはRoblox CDN直リンク

---

## やらないこと（スコープ外）

- フェーズ1-5の範囲では：認証、ユーザー登録、WebSocket/SSE、多言語対応、モバイルアプリ、サーバーごとCCU詳細取得
- 宣伝機能はフェーズ8以降（スキーマの布石だけ打つ）
- **blox.js** の導入：公式API直叩き実装（`lib/roblox-api.ts` / `lib/roblox-explore-api.ts`）で足りており、導入しない。`.ROBLOSECURITY` cookie運用が必要になった時点で再評価
- **Contentlayer / fumadocs** の導入：デフォルトはDB駆動（`stream_featured_articles`）で、Yukiが Supabase Dashboard から即時編集できる方針を優先。フェーズ7で記事本文のリッチさ・編集頻度を見てMDX採用を再評価する余地あり

---

## 質問・確認

設計判断に迷った時、スキーマ・スタックから逸脱しそうな時は、**勝手に進めず必ず確認を取る**。

特に：
- ランキングページで装飾やサイズ差を入れたくなったら停止
- 「1位を目立たせるべき」と思ったらUI設計原則を再読
- 「この数字をコードに書けばいい」と思ったら拡張設計ガイドライン#2を再読
- 新テーブル追加を考えたら拡張設計ガイドライン#1, #4を再読

---

## 現在のフェーズ

**→ フェーズ1〜5は概ね実装済み（`/`, `/trending`, `/categories`, `/new`, `/global`, `/game/[id]`, `/featured` が稼働）。次はフェーズ6（タグ機能）。**

参考資料（必ず目を通す）：
- `higesakusei/新しい方向性/タグ仕様書.txt` — タグ機能の開発チケット一覧（P0〜P2、MVP1〜3スコープ分割済み）
- `higesakusei/新しい方向性/配信者導線.txt` — 配信者導線のv1.0仕様書（DB/API/コンポーネント/受け入れ条件まで完備）
- Notion「ro-bro.jp 企画メモ」「まず結論」 — プロダクト哲学「面白さの通訳」の原典

フェーズ6着手時は、タグ仕様書の **P0チケット14件（MVP1スコープ）** をそのまま落とし込む。
