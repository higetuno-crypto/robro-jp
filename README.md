# robro-jp

日本語圏向けの Roblox ゲーム発見プラットフォーム（Next.js 14 + Supabase）。
プロジェクトの背景・UI 原則・スキーマは [`CLAUDE.md`](./CLAUDE.md) を参照。

## セットアップ

```bash
pnpm install
cp .env.local.example .env.local   # 後述の env を埋める
pnpm dev
```

開発サーバーは http://localhost:3000 で起動。

## 必要な環境変数

| 変数 | 用途 | 必須 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase プロジェクト URL                     | ✅（本番ビルド・実行） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase anon key（クライアント／公開読み取り）| ✅（同上） |
| `SUPABASE_SERVICE_ROLE_KEY`        | Supabase service role key（API ルート専用）   | ✅（API ルート実行時） |
| `CRON_SECRET`                      | `/api/cron/*` の Bearer 認証用シークレット     | ✅（cron 実行時） |
| `FINGERPRINT_SALT`                 | IP+UA ハッシュのソルト（投票重複防止用）       | ⛔（任意・未設定時は固定 salt） |
| `NEXT_PUBLIC_FEATURE_PROMOTION`    | 宣伝機能フラグ（v4 では未使用）                | ⛔ |

- `SUPABASE_SERVICE_ROLE_KEY` は **絶対にクライアントに渡さない**。`lib/supabase.ts` の `createServiceClient` 経由でサーバー側のみ使用。
- `CRON_SECRET` を未設定のまま cron エンドポイントを叩くと 401。
- 環境変数が無い状態でも `pnpm build` は通る（`app/sitemap.ts` が動的部分をスキップして静的URLだけ返すように実装）。

## よく使うコマンド

```bash
pnpm dev                      # 開発サーバー
pnpm build && pnpm start      # 本番ビルド + 起動
pnpm lint                     # ESLint
pnpm exec tsc --noEmit        # 型チェック
pnpm audit --prod             # 本番依存の脆弱性スキャン
```

## ディレクトリ概要

- `app/` … Next.js App Router（ランキング、タグ、配信、ご意見ボード、`/admin` 等）
- `lib/` … Supabase クライアント、Roblox API ラッパ、投票・タグ・モデレーションのドメインロジック
- `components/` … 共通 UI（`RankingRow`, `TagBadge`, `StreamMetaPanel` 等）
- `supabase/migrations/` … 0001 → 番号順に流す SQL
- `scripts/` … 一度だけ実行するメンテナンス系（`purge-roblox-data.ts` など）

## 詳細

- 設計原則・規約 → [`CLAUDE.md`](./CLAUDE.md)
- 仕様書・採否決定 → `higesakusei/` 配下
