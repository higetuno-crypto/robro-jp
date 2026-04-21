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

- **日本語ファースト**：UIもデフォルトの並び順も、日本語ユーザーを中心に据える
- **軽量・高速**：初回表示1秒以内。モバイル最優先
- **誠実な数字**：Rolimonsなど他サイトのコピーではなく、自前で時系列を貯めて独自の「急上昇」を出す
- **拡張を前提**：**将来の機能（開発者登録、宣伝ポイント、企業宣伝、宣伝ランキング細分化）を最初から構造に織り込む**

---

## UI設計原則（最優先 / 迷ったらここに戻る）

このサイトは**3種類**のページで構成される。それぞれUI思想が違う。**絶対に混ぜない**。

### A. ランキングページ（/, /trending, /japanese）

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

### C. 宣伝ページ（/promoted、フェーズ6以降）

**思想：ゲーム開発者が有償で獲得した露出枠。「誰がいくら払ったか」を可視化することで信頼性を担保する。**

- ピックアップより機能的・一覧的
- 宣伝の種別（ユーザー宣伝 / 企業宣伝）を明示
- 消費ポイントと期間を明示（ステルスマーケティング回避）
- ランキングは細分化可能：少額多数 / 高額少数 / 企業のみ / ユーザーのみ

### ナビゲーション階層（絶対に混ぜない）

```
ヘッダー：[ランキング] [ピックアップ] [宣伝]  ← 宣伝はフェーズ6以降
  ├─ ランキング配下タブ：[総合] [急上昇] [日本語]
  ├─ ピックアップ：単独ページ
  └─ 宣伝：配下タブ [総合] [企業] [ユーザー] [新着] など（将来）
```

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
│   │   ├── page.tsx                  # / 総合
│   │   ├── trending/page.tsx
│   │   └── japanese/page.tsx
│   ├── featured/
│   │   └── page.tsx                  # /featured ピックアップ
│   ├── promoted/                     # フェーズ6以降
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
│   ├── roblox-api.ts
│   ├── rolimons-api.ts
│   ├── japanese-detector.ts
│   └── promotion/                    # フェーズ6以降
│       ├── pricing.ts                # 料金計算
│       └── ranking.ts                # 宣伝ランキングのクエリ生成
├── components/
│   ├── RankingRow.tsx                # 全順位共通の1行
│   ├── FeaturedCard.tsx
│   ├── PromotedRow.tsx               # フェーズ6以降
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
  -- 将来の拡張用：開発者登録機能で使う
  owner_account_id BIGINT,    -- accountsテーブルへのFK（フェーズ6以降）
  is_verified_by_us BOOLEAN DEFAULT FALSE,  -- 自前認証
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_games_is_japanese ON games(is_japanese);
CREATE INDEX idx_games_updated_at ON games(updated_at);
CREATE INDEX idx_games_owner ON games(owner_account_id);

-- 時系列スナップショット
CREATE TABLE game_snapshots (
  universe_id BIGINT REFERENCES games(universe_id),
  captured_at TIMESTAMPTZ NOT NULL,
  playing INT NOT NULL,
  visits BIGINT,
  favorites BIGINT,
  PRIMARY KEY (universe_id, captured_at)
);
CREATE INDEX idx_snapshots_captured_at ON game_snapshots(captured_at DESC);

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

### フェーズ6以降で使うテーブル（設計だけ先に固める）

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
**ゴール**：5〜10分ごとに上位500件のCCUが蓄積される。

- [ ] `lib/rolimons-api.ts`：上位500件のUniverseIdリスト取得
- [ ] `lib/roblox-api.ts`：100件ずつバッチ、バッチ間500msディレイ
- [ ] `lib/japanese-detector.ts`：ルールベース判定
- [ ] `app/api/cron/fetch-games/route.ts`：Rolimons → Roblox → Supabase upsert + snapshot insert
- [ ] `CRON_SECRET` でBearer認証
- [ ] `vercel.json` に `"*/10 * * * *"`

**完了条件**：手動叩きで500件追加、2回目で重複エラーなし。

### フェーズ2：総合ランキング
**ゴール**：最新スナップショットの `playing` 降順トップ100。

- [ ] `(ranking)/layout.tsx`：タブナビ
- [ ] `(ranking)/page.tsx`：Server ComponentでJOIN
- [ ] `components/RankingRow.tsx`：全順位で見た目同じ
- [ ] モバイル縦リスト、デスクトップテーブル
- [ ] 更新時刻表示
- [ ] `revalidate = 300`

**完了条件**：1位と100位の見た目が順位バッジ以外同じ。

### フェーズ3：急上昇・日本語タブ
**ゴール**：3種類のランキング。

- [ ] `/trending`：変化率計算
- [ ] `/japanese`：`is_japanese=true` フィルタ
- [ ] **同じ `RankingRow` を使い回す**

**完了条件**：3URLで並び順が異なる。行の見た目は全ページ同一。

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

### フェーズ6以降（設計のみ、実装は別スプリント）

以下はフェーズ1-5の基盤が安定してから着手。**設計段階でフェーズ1-5のスキーマには既に布石を打ってある**ので、既存データを壊さず追加できる。

- **フェーズ6**：アカウント登録（accountsテーブル、Roblox本人確認フロー）
- **フェーズ7**：ポイント購入・保有（Stripe連携、pricing_config活用）
- **フェーズ8**：宣伝枠購入（promotion_slots、promotion_transactions）
- **フェーズ9**：宣伝ページ `/promoted` と配下タブ
- **フェーズ10**：宣伝ランキング細分化（SQL View追加で実現）

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

- Rolimons API：1分に1〜2回まで
- Roblox公式API：UniverseId 100件/req、バッチ間500ms
- プロキシ禁止（rprxy.xyz等）
- サムネはRoblox CDN直リンク

---

## やらないこと（スコープ外）

- フェーズ1-5の範囲では：認証、ユーザー登録、WebSocket/SSE、多言語対応、モバイルアプリ、サーバーごとCCU詳細取得
- 宣伝機能はフェーズ6以降（スキーマの布石だけ打つ）

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

**→ フェーズ0から開始してください。**
