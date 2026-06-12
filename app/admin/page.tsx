import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div className="space-y-3 text-[14px]">
      <p className="text-muted-foreground">
        左のメニューから操作対象を選ぶ。
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <Link href="/admin/tags" className="underline">
            タグプール管理（公式・ユーザー選択式）
          </Link>
        </li>
        <li>
          <Link href="/admin/games" className="underline">
            ゲーム別タグ管理（票数増減・削除）
          </Link>
        </li>
        <li>
          <Link href="/admin/feedback" className="underline">
            ご意見の管理（状態変更・非表示）
          </Link>
        </li>
        <li>
          <Link href="/admin/strategy-tips" className="underline">
            攻略Tips モデレーション（通報キュー・非表示/削除）
          </Link>
        </li>
      </ul>
    </div>
  );
}
