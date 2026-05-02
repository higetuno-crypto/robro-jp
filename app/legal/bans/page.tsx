import { createBrowserClient } from '@/lib/supabase';

/**
 * /legal/bans BAN 公開ログ（H5：透明性）
 *
 * 直近のモデレーション処分を一般公開し、運営の判断を可視化する。
 * ターゲット個人の特定情報は出さず、種別・理由・日付のみ。
 */

export const metadata = {
  title: 'モデレーションログ',
  description: 'ro-brojp の運営による直近のモデレーション処分（BAN・削除）の透明性公開ログ',
};

export const revalidate = 300;

const TYPE_LABEL: Record<string, string> = {
  account: 'アカウント',
  creator: 'クリエイター',
  game: 'ゲーム',
};
const REASON_LABEL: Record<string, string> = {
  spam_vote: '投票操作・水増し',
  fake_creator: 'なりすましクリエイター',
  tos_violation: '規約違反',
  self_promo_abuse: '自己プロモーション乱用',
  other: 'その他',
};

interface BanRow {
  id: number;
  target_type: string;
  reason_code: string;
  reason_detail: string;
  banned_at: string;
  appeal_status: string;
}

export default async function BansPage() {
  const supabase = createBrowserClient();
  const { data } = await supabase
    .from('moderation_ban_logs')
    .select('id, target_type, reason_code, reason_detail, banned_at, appeal_status')
    .order('banned_at', { ascending: false })
    .limit(100);

  const rows = (data as BanRow[] | null) ?? [];

  return (
    <main className="max-w-3xl mx-auto px-3 py-6">
      <h1 className="text-[18px] font-semibold">モデレーションログ</h1>
      <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
        ro-brojp の運営によるモデレーション処分（投票操作・なりすまし等への対応）を公開します。
        個人の特定情報は出さず、種別・理由・日付のみを記録します。異議申立は{' '}
        <a href="/contact" className="underline">お問い合わせ</a> から受け付けます。
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-[13px] text-muted-foreground">
          現在、公開対象のモデレーション処分はありません。
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span>{new Date(r.banned_at).toLocaleString('ja-JP')}</span>
                <span>·</span>
                <span>{TYPE_LABEL[r.target_type] ?? r.target_type}</span>
                <span>·</span>
                <span>{REASON_LABEL[r.reason_code] ?? r.reason_code}</span>
                {r.appeal_status !== 'none' ? (
                  <>
                    <span>·</span>
                    <span>異議：{r.appeal_status}</span>
                  </>
                ) : null}
              </div>
              <div className="mt-1 text-[13px]">{r.reason_detail}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
