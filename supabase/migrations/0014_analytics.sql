-- 0014_analytics.sql
-- フェーズ A1：アナリティクス自己改善システムの DB スキーマ
-- 仕様書：higesakusei/analytics-spec-v2.md §5

-- ============================================================
-- analytics_snapshots: 隔週ごとのメトリクススナップショット
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('supabase','gsc','ga4','vercel')),
  -- v2.1: 'nim' を削除（NVIDIA NIM 採用見送り。すべて Claude で処理）
  metrics JSONB NOT NULL,
  validation_checksum TEXT,  -- 中核 KPI のハッシュ（ハルシネーション検出用）
  CONSTRAINT analytics_snapshots_unique_period UNIQUE (period_start, period_end, source)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period
  ON analytics_snapshots(period_end DESC, source);

COMMENT ON TABLE analytics_snapshots IS
  '隔週ごとのメトリクススナップショット。中核KPI K1-K3 と補助メトリクスをJSONBで格納。';
COMMENT ON COLUMN analytics_snapshots.metrics IS
  '{k1_discovery_lead_time_minutes, k2_small_creator_visibility_pct, k3_hidden_gems_count, votes, tags, games, creators, feedback, abuse, ...}';

-- ============================================================
-- analytics_insights: AI が生成する観察・仮説・行動・振り返り
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_insights (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end DATE NOT NULL,
  insight_type TEXT NOT NULL CHECK (
    insight_type IN ('observation','hypothesis','action','retrospective','contrarian')
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_kpi TEXT,                -- 'K1' | 'K2' | 'K3' | 補助KPI名
  predicted_direction TEXT CHECK (
    predicted_direction IN ('up','down','flat','shorten','extend')
  ),
  predicted_magnitude_pct REAL,
  confidence REAL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open','adopted','rejected','deferred','verified','falsified','inconclusive')
  ),
  parent_insight_id BIGINT REFERENCES analytics_insights(id),
  yuki_decision TEXT,              -- adopt/reject 理由
  yuki_decided_at TIMESTAMPTZ,
  generated_by TEXT NOT NULL DEFAULT 'claude'   -- 'claude' | 'nvidia'
);

CREATE INDEX IF NOT EXISTS idx_analytics_insights_status
  ON analytics_insights(status, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_parent
  ON analytics_insights(parent_insight_id);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_kpi
  ON analytics_insights(target_kpi);

COMMENT ON TABLE analytics_insights IS
  'AIが生成する観察・仮説・採用判定・検証結果。永続保持（学習データとして次サイクルが参照）。';
COMMENT ON COLUMN analytics_insights.status IS
  'open(未判定) → adopted/rejected/deferred(Yuki判定) → verified/falsified/inconclusive(次期で検証)';
COMMENT ON COLUMN analytics_insights.insight_type IS
  'contrarian = Yuki の bias 増幅防止のため、過去 rejected と逆方向の仮説（仕様書 §7.6）';

-- ============================================================
-- analytics_classifications: Claude による分類結果キャッシュ
-- フェーズ A2 で使用開始（v2.1: NIM は採用見送り、Claude 一本化）
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_classifications (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('feedback')),
  -- 注意：v2 では feedback のみ。Roblox 由来データ（game.description 等）は規約上の懸念から対象外
  target_id TEXT NOT NULL,
  classification_type TEXT NOT NULL,    -- 'sentiment' | 'category'
  result JSONB NOT NULL,
  model TEXT NOT NULL,                  -- 'claude-sonnet-4.7' など（モデル世代の追跡用）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_classifications_unique_target
    UNIQUE (target_type, target_id, classification_type, model)
);

COMMENT ON TABLE analytics_classifications IS
  'Claude による分類結果キャッシュ。6ヶ月で archive。v2.1 では feedback のみが対象。';

-- ============================================================
-- RLS（Row Level Security）：anon は読み書き不可、service role のみ操作可
-- 表示は Yuki 専用（/admin と同じ Basic Auth 経由でアクセス）
-- ============================================================
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_classifications ENABLE ROW LEVEL SECURITY;

-- service role はすべて操作可（RLS バイパス）
-- anon / authenticated にはポリシーを作らない = アクセス不可

-- ============================================================
-- ロールバック手順（必要時）
-- ============================================================
-- DROP TABLE IF EXISTS analytics_classifications;
-- DROP TABLE IF EXISTS analytics_insights;
-- DROP TABLE IF EXISTS analytics_snapshots;
