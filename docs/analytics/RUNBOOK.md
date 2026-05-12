# robro-jp アナリティクス運用 RUNBOOK

このファイルは Claude Code が「冷スタート」で隔週サイクルを実行できるようにするための手順書とプロンプトテンプレ集です。

対応仕様書：`higesakusei/analytics-spec-v2.1.md`（v2.1 で NIM 採用見送り → Claude 一本化）
最終更新：2026-05-09
バージョン：v1.0

---

## 0. このファイルの読み方

Claude Code が「隔週レポート作って」と頼まれたら、まず以下の順で読みます：

1. このファイル（RUNBOOK）の §1〜§5
2. `higesakusei/analytics-spec-v2.1.md` の §2（KPI 定義）、§7（ループ仕様）
3. `CLAUDE.md` の「ビジョン」「UI設計原則」「やらないこと」
4. 直近 8 期分の `analytics_insights`（DB クエリ）

人間（Yuki）はこのファイルを読む必要はない。Yuki が見るのは HTML レポートだけ。

---

## 1. 隔週サイクル実行の標準コマンド

```bash
pnpm run analytics:cycle
```

これは内部的に：
1. `scripts/collect-snapshot.ts`（Supabase 集計 → `analytics_snapshots` insert）
2. `scripts/generate-report.ts`（仮説生成 → MD/HTML 出力）
3. `scripts/validate-report.ts`（数値ハルシネーション検出）

を順次実行する。

---

## 2. 中核 KPI 一覧（必ず覚える）

| ID | 名称 | 定義 | 目標方向 |
|---|---|---|---|
| **K1** | 非英語圏ゲーム発見リードタイム | `is_japanese=TRUE` ゲームの first_seen_at から「初の🔥または⭐獲得」までの中央値（分） | **短縮** |
| **K2** | 小規模クリエイター可視性 | /recommends TOP100 における `CCU<100` のゲーム比率 | **上昇** |
| **K3** | 隠れ良作発見率 | first_seen_at が直近90日内かつ recommend_vote >= 3 のゲーム数 | **上昇** |

**重要**：vote_count / PV / 検索流入は補助指標。K1-K3 にトレースバックできない仮説は出さない。

---

## 3. システムプロンプト（Step 3: 提案 用）

Claude Code が `scripts/generate-report.ts` 内で自分自身に与えるシステムプロンプト。

```
あなたは robro-jp のアナリティクス担当 AI です。
以下を厳守してください：

# 思想原則
- 北極星は「優秀なクリエイターが真っ当に評価されればそれでいい」
- 中核 KPI は K1（非英語圏ゲーム発見リードタイム）、K2（小規模クリエイター可視性）、K3（隠れ良作発見率）のみ
- vote_count / PV / 検索流入は補助。これらだけを上げる仮説は禁止
- 「バズるゲームをトップに出す」「広告を増やす」「CTR を最適化する」は北極星と無関係の提案として除外

# 過去学習の参照
- 直近 2 期の status='falsified' と 'rejected' の insights を必ず確認し、同種の仮説を再提案しない
- 過去の retrospective を読み、同じ罠を避ける

# 出力品質基準（§7.5）
hypothesis の品質基準を満たさないなら出力しない。数合わせ禁止。
品質基準：
  1. K1〜K3 のいずれかに紐付いている
  2. predicted_direction と predicted_magnitude_pct が明示されている
  3. 実装工数の見積もり（small/medium/large）がある
  4. 過去2期で同種の仮説が rejected/falsified されていない

最大3件まで。基準未達なら0件で OK。

# 逆張り仮説（§7.6）
必ず1件、Yuki の過去 rejected と逆方向の contrarian 仮説を出す。
Yuki が嫌いそうだが、データ上は無視できない線を狙う。

# 判定の素直さ（§7.4）
- verified: 予測方向一致 AND 大きさ±50% 範囲内 AND サンプル基準満たす
- falsified: 予測と逆方向 OR 大きさ50%未満（サンプル基準は満たす）
- inconclusive: サンプル基準未達 OR 観測誤差範囲内（±2%以内）
判定不能は素直に inconclusive と記録。verify/falsify の偽装禁止。

# 数値の引用元
すべて analytics_snapshots の値から引用。記憶からの値生成は禁止。
出力後、§8.3 の数値バリデーションを通すこと。
```

---

## 4. ユーザープロンプト（Step 3: 提案 用）

```
今期のスナップショット（period_end={period_end}）から、隔週レポートを生成してください。

# 入力データ
- 今期 snapshot: {today_snapshot_json}
- 前期 snapshot: {prev_snapshot_json}
- 直近 8 期分の insights: {insights_json}

# 出力フォーマット
仕様書 §8.1 の MD フォーマットに従う。frontmatter 必須。

# 構成
## core_kpis
K1, K2, K3 の今期/前期/Δ/サンプル数/評価可否を表形式で

## verified_hypotheses
status='adopted' の hypothesis について、今期実測で verified/falsified/inconclusive のいずれかを判定

## observations
今期のスナップショットから K1-K3 中心に観察 1-3 件

## new_hypotheses
品質基準を満たす hypothesis を最大3件（0件 OK）

## contrarian
逆張り仮説1件

## retrospective
今期の振り返り、次期への学び

最後に "validation_passed: true" を frontmatter に追記する想定で、数値はすべて snapshot からの正確な引用を貫く。
```

---

## 5. 検証プロンプト（Step 2: 検証 用）

`scripts/generate-report.ts` の Step 2 段階で使う。

```
以下の adopted な hypothesis について、今期実測で判定してください：

# Hypothesis
- id: {insight_id}
- title: {title}
- target_kpi: {target_kpi}
- predicted_direction: {direction}
- predicted_magnitude_pct: {magnitude}
- 採用された期: {adopted_period_end}

# 今期実測
- 該当 KPI 値: {actual_value}
- 前期値（採用時のベースライン）: {baseline_value}

# 判定ルール
- verified: 方向一致 AND |実測 - 予測| / |予測| <= 0.5 AND サンプル基準満たす
- falsified: 逆方向 OR 大きさ予測50%未満（サンプル基準満たす）
- inconclusive: サンプル基準未達 OR 観測誤差範囲内（K1なら±2%、K2なら±2pp、K3なら±1件）

判定と簡潔な理由を返してください。
```

---

## 6. レポート HTML テンプレート

`scripts/generate-report.ts` が組み立てる HTML の骨組み：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>robro-jp アナリティクス {period_end}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  body { font-family: -apple-system, "Segoe UI", "Hiragino Sans", sans-serif; max-width: 960px; margin: 0 auto; padding: 16px; }
  .kpi-card { display: inline-block; padding: 16px; border: 1px solid #ddd; margin-right: 8px; min-width: 200px; }
  .kpi-card .delta-up { color: green; }
  .kpi-card .delta-down { color: red; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .hypothesis { border: 1px solid #ddd; padding: 12px; margin: 8px 0; }
  .hypothesis.contrarian { border-color: #f60; background: #fff8f0; }
  .warning { background: #ffe; border: 1px solid #fc0; padding: 8px; }
  form { display: inline; }
  button { padding: 6px 12px; cursor: pointer; }
</style>
</head>
<body>
  <h1>アナリティクス {period_end}</h1>
  <p>期間：{period_start} 〜 {period_end}</p>

  {warning_if_validation_failed}

  <h2>中核 KPI</h2>
  <div class="kpi-cards">
    <div class="kpi-card">K1 リードタイム {k1_now}h <span class="delta-{dir}">Δ{k1_delta}</span></div>
    <div class="kpi-card">K2 小規模可視性 {k2_now}% <span class="delta-{dir}">Δ{k2_delta}</span></div>
    <div class="kpi-card">K3 隠れ良作 {k3_now}件 <span class="delta-{dir}">Δ{k3_delta}</span></div>
  </div>

  <h2>時系列</h2>
  <canvas id="trendChart"></canvas>
  <script>
    /* chart.js でレンダリング */
  </script>

  <h2>前期 hypothesis の検証</h2>
  <table>...</table>

  <h2>今期の観察</h2>
  ...

  <h2>新規仮説</h2>
  {for each hypothesis}
    <div class="hypothesis">
      <h3>{title}</h3>
      <p>{body}</p>
      <form method="POST" action="/api/insights/decision">
        <input type="hidden" name="insight_id" value="{id}">
        <button name="decision" value="adopted">採用</button>
        <button name="decision" value="rejected">却下</button>
        <button name="decision" value="deferred">保留</button>
      </form>
    </div>
  {endfor}

  <h2>逆張り提案</h2>
  <div class="hypothesis contrarian">
    {contrarian content}
  </div>

  <h2>振り返り</h2>
  ...
</body>
</html>
```

---

## 7. トラブルシューティング

### バリデーション失敗（`validation_passed: false`）
- `scripts/validate-report.ts` のログを確認
- どの数値が DB と乖離していたか
- 多くは Claude のハルシネーション → MD を再生成

### スナップショットが空
- `collect-snapshot.ts` のログ確認
- DB 接続・service role key 確認
- period が正しく計算されているか（前回 period_end +1 〜 今日 -1）

### insight が0件生成された
- これは正常動作の可能性大（§7.5 品質基準を満たさなかった）
- 「観察が薄い期」だったと記録すれば OK

### Yuki がレポートを開かない
- `latest.html` の URL をブックマークしてもらう
- 通知連携は後日（Slack / メール）

---

## 8. 関連ファイル

- 仕様書：`higesakusei/analytics-spec-v2.md`
- A0 チェックリスト：`higesakusei/analytics-a0-checklist.md`
- A1 チケット：`higesakusei/analytics-tickets-a1.md`
- DB マイグレーション：`supabase/migrations/0014_analytics.sql`
- KPI 計算：`lib/analytics/kpi.ts`（A1 で実装）
- 収集スクリプト：`scripts/collect-snapshot.ts`（A1 で実装）
- レポート生成：`scripts/generate-report.ts`（A1 で実装）
- バリデーション：`scripts/validate-report.ts`（A1 で実装）
- オーケストレータ：`scripts/run-analytics-cycle.ts`（A1 で実装）
- 承認 API：`app/api/insights/decision/route.ts`（A1 で実装）
