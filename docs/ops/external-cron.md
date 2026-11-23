# 外部スケジューラへの cron 移設（対処 C）

## なぜ移設するのか

robro-jp のデータ収集は GitHub Actions の `schedule` で回していたが、2 つの問題が実測で確認された。

**1. 60 日無活動で自動停止する**

GitHub はリポジトリに 60 日間コミットが無いと `schedule` を自動で無効化する（workflow state が `disabled_inactivity`）。通知は実質届かず、サイトは表示上壊れないため気づけない。

- 2026-08-02 のコミットを最後に無活動 → 2026-10-01 に 4 本すべて停止 → 2026-10-24 に発見
- **23 日間 CCU スナップショットが欠損した**（この期間のデータは取り返せない）

**2. 復帰後も指定間隔を守らない**

`gh workflow enable` + workflow ファイルに触れる push の 2 手で復帰させたが、`*/10` の指定に対する実測発火間隔は次の通りだった（2026-10-25〜26）。

| 時刻 (UTC) | 直前からの間隔 |
|---|---|
| 10-25 22:00 | — |
| 10-26 00:07 | 約 2 時間 |
| 10-26 04:35 | 約 4.5 時間 |
| 10-26 09:03 時点で未発火 | 4.5 時間以上 |

10 分指定に対して 2〜4.5 時間。robro-jp の価値は **10 分粒度の CCU 時系列**にあるため、この粒度では独自の「急上昇」が成立しない。

GitHub Actions 側の設定は全項目正常（state `active` / Actions `enabled` / `schedule: '*/10'` 反映済み / サービス `operational` / public repo で分数無制限）であり、**こちら側に打つ手が無い**。制御可能な場所へスケジューラを移す。

## 方針

- **スケジューラだけを外に出す。** endpoint・認証・処理内容は一切変えない
- **GitHub Actions は消さない。** 外部側が数日安定するのを確認するまで二重に回す。先に消すと外部が動かなかった場合に無保護になる
- **外部に渡す鍵は内部と分ける**（下記）

移設対象は 4 本。`purge-disclosure-logs` は Vercel Cron（日次）のままで触らない。

| endpoint | method | 間隔 |
|---|---|---|
| `/api/cron/fetch-games` | GET | `*/10 * * * *` |
| `/api/cron/refresh-voting-scores` | GET | `*/10 * * * *` |
| `/api/cron/detect-spam-votes` | POST | `*/5 * * * *` |
| `/api/cron/award-badges` | POST | `0 19 * * *`（JST 04:00） |

---

## 専用 secret（`CRON_SECRET_EXTERNAL`）

### なぜ分けるのか

外部サービスには secret を預けることになる。`CRON_SECRET` をそのまま渡すと、第三者の管理画面に内部スケジューラと共通の鍵が置かれ、片方だけ失効させられない。

鍵を 2 本に分けると:

- **封じ込め** — cron-job.org 側が漏れても、その鍵だけ失効すれば GitHub Actions / Vercel Cron は止まらない
- **ローテーション独立** — 内部鍵を定期的に回しても外部サービスの設定を触らずに済む（逆も同じ）
- **識別** — `authorizeCron()` が `'internal' | 'external'` を返すので、どちら経由の呼び出しか判別できる

権限自体は同じ endpoint に通るので、これは「権限の分離」ではなく**「鍵の分離」**。endpoint 単位で絞る設計も検討したが、外部スケジューラは 4 本すべてを叩くため絞る意味がなく、設定項目を増やすだけなので採らなかった。

### 実装

認証は [`lib/cron-auth.ts`](../../lib/cron-auth.ts) に集約済み（移設前は同じチェックが 5 routes にコピーされていた）。

- `CRON_SECRET` … 内部（GitHub Actions / Vercel Cron）
- `CRON_SECRET_EXTERNAL` … 外部（cron-job.org / Cloudflare Worker）
- 比較は SHA-256 ダイジェスト同士の `timingSafeEqual`。長さが 32 byte に揃うため secret 長が漏れない
- **どちらも未設定なら一律 401**（fail-closed）。設定漏れで全公開になるより閉じる

### 値の生成と登録

```bash
# 32 byte ランダムを base64url で（CRON_SECRET とは必ず別の値にする）
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Vercel → Project Settings → Environment Variables に `CRON_SECRET_EXTERNAL` として **Production** に登録 → 再デプロイで有効化。

> `.env.local` にも同じ値を入れておくとローカルで 401/200 の確認ができる。

### ローテーション手順

1. 新しい値を生成
2. Vercel の `CRON_SECRET_EXTERNAL` を新しい値に更新 → 再デプロイ
3. 外部サービス側のヘッダを新しい値に更新
4. 外部側のログで 200 を確認

※ 2 と 3 の間は外部呼び出しが 401 になる。`fetch-games` は次の 10 分で追いつくので実害はない。無停止で回したい場合は一時的に 2 本目の変数を足す運用にする。

---

## 選択肢 A: cron-job.org（コード不要・推奨の第一手）

無料、最短 1 分間隔、アカウント作成だけで使える。Worker を書かずに今日中に復旧できる。

### 手順

1. <https://cron-job.org> → **Sign up**（メール認証のみ）

2. **Create cronjob** で 1 本目を作る

   | 項目 | 値 |
   |---|---|
   | タイトル | `robro-jp fetch-games` |
   | URL | `https://www.ro-brojp.com/api/cron/fetch-games` |
   | スケジュール | 10 分ごと（定義済みスケジュールか、カスタムで `*/10`） |
   | リクエストメソッド | `GET` |
   | カスタムヘッダ | `Authorization: Bearer <CRON_SECRET_EXTERNAL の値>` |

   画面上の項目名は UI 更新で変わりうる。公式 FAQ で確認できたのは「リクエストメソッド・ヘッダ・ボディを設定できる」「任意のカスタムヘッダに対応（`User-Agent` と `Connection` だけは無視される）」まで。

   > **URL は必ず `www.` 付きで登録する。** apex（`ro-brojp.com`）は www へ 307 リダイレクトされ、リダイレクト時に `Authorization` ヘッダが落ちて 401 になる。

3. 保存して実行させ、ジョブの実行履歴で `200` と `{"ok":true,"fetched":...}` が返ることを確認

4. 残り 3 本を同様に作る（間隔と method を上表に合わせる）。
   `award-badges` は**タイムゾーンの設定に注意**（JST なら 04:00、UTC なら 19:00）

5. 失敗時のメール通知を on にする（「失敗した時」と「失敗から復帰した時」の通知がある）。
   GitHub Actions の停止に 23 日気づけなかった原因は通知が無かったことなので、ここは必ず設定する

### 公式 FAQ で確認した制約（2026-11-23 時点）

- **タイムアウトは 30 秒固定**。`fetch-games` は実測 5〜8 秒なので収まるが、Roblox API が遅いと超える可能性はある
- 最短間隔は 1 分（1 時間 60 回まで）
- 実行履歴は直近 50 回分、レスポンスのヘッダと本文は 2 日間保存。長期の観測は Vercel 側のログで
- **失敗が 25 回を超えるとジョブは自動で無効化される**（FAQ の表現は "subsequently fails more than 25 times"）。過去に失敗の多いジョブは意図的に遅延されることもある
- 送信元 IP は固定（一覧は <https://api.cron-job.org/executor-nodes.json>）。IP 制限をかける場合に使える
- カスタムヘッダの値（＝ secret）が暗号化保存されるかは FAQ に記載がない。気になる場合は選択肢 B

### 既知の注意：Roblox の 429 が失敗として数えられる

`fetch-games` は Roblox API が 429 を返すと HTTP 500 を返す（2026-11-20〜23 の実測で、`fetch-games` の直近 8 回中 2 回）。cron-job.org はこれを失敗として数えるため、

- 失敗通知が頻繁に届き、本当の停止が埋もれる
- 失敗の多いジョブとして遅延・自動無効化の対象になりうる

末尾の「既知の未解決事項」を直すまでは、通知が来ても 429 かどうかを本文で見分ける必要がある。

---

## 選択肢 B: Cloudflare Workers Cron Triggers（secret を自前管理）

コードは [`ops/cloudflare-cron-worker/worker.js`](../../ops/cloudflare-cron-worker/worker.js) にある。セットアップ手順はファイル冒頭のコメントに記載。

A との違い:

- secret は Cloudflare の encrypted secret に入り、third-party の管理画面に置かれない
- 4 endpoint を 1 Worker でまとめられる
- Roblox の 429 に対して 1 回リトライを入れてある（CLAUDE.md の「429 を正常系として扱う」方針に沿わせた）
- 無料プランは **1 Worker あたり Cron Triggers 3 本まで**。上表は 3 本に収まる

どちらを選んでもアプリ側の変更は不要。両方同時に動かしても `CONCURRENTLY` な REFRESH と upsert は冪等なので壊れない。

---

## 移設後にやること

1. 外部側が **3〜4 日**安定して 200 を返すのを確認
2. GitHub Actions 側を停止（workflow ファイルは残し、`schedule:` だけコメントアウトするか `gh workflow disable` する）
3. 監視の目印: トップページの「N分前更新」が **30 分以上**古ければ外部スケジューラを疑う

## 既知の未解決事項

`fetch-games` は Roblox API が 429 を返すと HTTP 500 で落ちる（2026-10-25 22:00 の実例）。CLAUDE.md は「429 を正常系として扱い、指数バックオフ＋jitter＋強キャッシュで運用」としているので、route 側の挙動はこの方針に合っていない。Worker 側のリトライで実害は薄まるが、本来は route 内で処理すべき。別途対応。
