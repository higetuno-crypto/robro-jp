/**
 * MOD-04 ネガティブ表現の辞書ガードレール。
 *
 * CLAUDE.md「運営コンプライアンス」§資料5 L29-45 Community Standards：
 * 体型・特徴辱め、差別表現、誹謗中傷の防止。
 *
 * 2段構え：
 *  - BLOCK_WORDS: 発見即拒否（入力差し戻し）
 *  - REPLACE_WORDS: 推奨置換（入力は通すが警告 + 置換提案）
 *
 * 発動場所：
 *  - ADMIN-02（タグ追加・編集フォーム）
 *  - 将来の featured headline / stream meta 入力
 *
 * MVP の方針：管理者入力時のみ発動。ユーザー側のタグ投票は選択式（tag_master 由来）
 * なので自由入力経路がなく、辞書は不要。
 */

// 完全ブロック：保存させない
const BLOCK_WORDS: readonly string[] = [
  // Roblox規約・コンプラ上の断定表現
  '安全に配信できます',
  '著作権的に問題ありません',
  '絶対バズる',
  '必ず盛り上がります',
  '子ども向けです',
  '子供向けです',
  '公式',
  '公認',
  'パートナー',
  '認定',
  // 人格攻撃・差別
  '死ね',
  '殺す',
  'クソゲー',
  'ガイジ',
  'キモい',
  'ブス',
  'デブ',
  'チー牛',
  // 年齢・属性への蔑視（資料5 L29-45 に対応）
  'ガキ向け',
  'ジジイ向け',
  'ババア向け',
  '知恵遅れ',
  // 地域・治安系のネガ断定
  '治安終わってる',
  '民度最悪',
];

// 推奨置換（どうしても使いたいならこっち）：警告付きで通す
const REPLACE_WORDS: ReadonlyArray<{ from: string; to: string; why: string }> = [
  { from: 'クソゲー',         to: '好み分かれる',       why: '断定より主観表現に' },
  { from: 'ガキ向け',         to: '年齢層低めの印象',   why: '蔑視でなく中立表現に' },
  { from: '絶対バズる',       to: '配信映えしやすい',   why: '予言でなく傾向表現に' },
  { from: '治安終わってる',   to: '治安に波あり',       why: '断定を弱める' },
  { from: '民度最悪',         to: '雰囲気が独特',       why: '攻撃性を中和' },
  { from: '子ども向け',       to: '年齢感は低〜中学年寄りの印象', why: '断定より印象表現に' },
  { from: '子供向け',         to: '年齢感は低〜中学年寄りの印象', why: '断定より印象表現に' },
];

export interface ModerationIssue {
  severity: 'block' | 'warn';
  word: string;
  suggestion?: string;
  reason?: string;
}

/**
 * 入力テキストをチェックし、問題点の配列を返す。
 * 空配列なら問題なし。block が1つでもあれば保存を拒否するのが呼び出し側の責務。
 */
export function moderateText(input: string): ModerationIssue[] {
  if (!input) return [];
  const issues: ModerationIssue[] = [];
  for (const w of BLOCK_WORDS) {
    if (input.includes(w)) {
      issues.push({ severity: 'block', word: w });
    }
  }
  for (const r of REPLACE_WORDS) {
    if (input.includes(r.from)) {
      // 同じ語が BLOCK にも入っている場合は block を優先、warn は出さない
      if (issues.some((i) => i.word === r.from)) continue;
      issues.push({
        severity: 'warn',
        word: r.from,
        suggestion: r.to,
        reason: r.why,
      });
    }
  }
  return issues;
}

export function hasBlockingIssue(issues: ModerationIssue[]): boolean {
  return issues.some((i) => i.severity === 'block');
}

/**
 * ユーザー投稿（攻略Tips等）用のブロック語。
 *
 * 管理者入力用 BLOCK_WORDS との違い：
 *  - affiliation 語（公式 / 公認 / パートナー / 認定）は **ブロックしない**。
 *    これは robro-jp 自身が「公式」を騙るのを防ぐための語であり、
 *    ユーザーが攻略で「公式アップデートで追加された武器」等と書くのは正常表現のため。
 *  - 人格攻撃・差別・脅迫・属性蔑視のみブロックする（資料5 L29-45 Community Standards）。
 */
const USER_TIP_BLOCK_WORDS: readonly string[] = [
  '死ね',
  '殺す',
  'クソゲー',
  'ガイジ',
  'キモい',
  'ブス',
  'デブ',
  'チー牛',
  'ガキ向け',
  'ジジイ向け',
  'ババア向け',
  '知恵遅れ',
  '治安終わってる',
  '民度最悪',
];

/**
 * ユーザー投稿（攻略Tips）用モデレーション。
 * 空配列なら問題なし。block が1つでもあれば保存を拒否するのが呼び出し側の責務。
 */
export function moderateUserTip(input: string): ModerationIssue[] {
  if (!input) return [];
  const issues: ModerationIssue[] = [];
  for (const w of USER_TIP_BLOCK_WORDS) {
    if (input.includes(w)) {
      issues.push({ severity: 'block', word: w });
    }
  }
  for (const r of REPLACE_WORDS) {
    if (input.includes(r.from)) {
      if (issues.some((i) => i.word === r.from)) continue;
      issues.push({
        severity: 'warn',
        word: r.from,
        suggestion: r.to,
        reason: r.why,
      });
    }
  }
  return issues;
}

/** フォームの「全フィールドまとめてチェック」用 */
export function moderateFields(
  fields: Record<string, string | null | undefined>
): { field: string; issues: ModerationIssue[] }[] {
  const out: { field: string; issues: ModerationIssue[] }[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const issues = moderateText(value ?? '');
    if (issues.length > 0) out.push({ field, issues });
  }
  return out;
}
