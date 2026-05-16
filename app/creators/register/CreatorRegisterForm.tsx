'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SocialLink } from '@/lib/creators';

interface InitialState {
  creator_id: number;
  display_name: string;
  self_introduction: string;
  avatar_url: string;
  roblox_profile_url: string;
  social_links: SocialLink[];
  is_verified: boolean;
  verification_code: string | null;
  verification_expires_at: string | null;
}

interface Props {
  initial: InitialState | null;
}

const SOCIAL_PLATFORMS: { value: SocialLink['platform']; label: string }[] = [
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'blog', label: 'Blog' },
];

export function CreatorRegisterForm({ initial }: Props) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [intro, setIntro] = useState(initial?.self_introduction ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');
  const [robloxUrl, setRobloxUrl] = useState(initial?.roblox_profile_url ?? '');
  const [socials, setSocials] = useState<SocialLink[]>(initial?.social_links ?? []);

  const [creatorId, setCreatorId] = useState<number | null>(initial?.creator_id ?? null);
  const [isVerified, setIsVerified] = useState<boolean>(initial?.is_verified ?? false);
  const [code, setCode] = useState<string | null>(initial?.verification_code ?? null);
  const [codeExpires, setCodeExpires] = useState<string | null>(initial?.verification_expires_at ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addSocial = () => {
    if (socials.length >= 5) return;
    setSocials([...socials, { platform: 'x', url: '' }]);
  };
  const removeSocial = (i: number) => {
    setSocials(socials.filter((_, idx) => idx !== i));
  };
  const updateSocial = (i: number, patch: Partial<SocialLink>) => {
    setSocials(socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          self_introduction: intro,
          avatar_url: avatarUrl || null,
          roblox_profile_url: robloxUrl,
          social_links: socials.filter((s) => s.url.trim().length > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '登録に失敗しました');
        return;
      }
      setCreatorId(data.creator_id);
      setCode(data.verification_code);
      setCodeExpires(data.verification_expires_at);
      if (data.already_verified) {
        setIsVerified(true);
        setMessage('プロフィールを更新しました。本人確認済み状態は維持されています。');
        router.refresh();
      } else {
        setIsVerified(false);
        setMessage(
          `Roblox ユーザー名「${data.roblox_user_name}」を確認しました。下記のコードを Robloxプロフィール bio に貼り付け、24時間以内に確認ボタンを押してください。`
        );
      }
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!creatorId) return;
    setVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/creators/${creatorId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.hint ?? data?.error ?? '確認に失敗しました');
        return;
      }
      setIsVerified(true);
      setCode(null);
      setCodeExpires(null);
      setMessage('確認できました。プロフィールが公開されました。');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {isVerified ? (
        <div className="border border-border bg-muted/30 px-3 py-2 text-[13px]">
          ✓ 確認済みです。
          {creatorId ? (
            <a href={`/creators/${creatorId}`} className="underline ml-1">
              公開プロフィールを見る →
            </a>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium mb-1">
            表示名 <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            required
            className="w-full px-2 py-1.5 text-[14px] border border-border bg-background"
            placeholder="例：Yuki"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1">自己紹介（任意・800字まで）</label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            maxLength={800}
            rows={5}
            className="w-full px-2 py-1.5 text-[13px] border border-border bg-background"
            placeholder="どんな作品を作っているか、好きなジャンル、活動方針など"
          />
          <div className="text-[11px] text-muted-foreground mt-0.5">{intro.length} / 800</div>
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1">アバター画像URL（任意）</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="w-full px-2 py-1.5 text-[14px] border border-border bg-background"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1">
            Roblox プロフィール URL <span className="text-red-600">*</span>
          </label>
          <input
            type="url"
            value={robloxUrl}
            onChange={(e) => setRobloxUrl(e.target.value)}
            required
            pattern="https://(www\.)?roblox\.com/([a-z]{2}(-[a-z]{2})?/)?users/.*"
            className="w-full px-2 py-1.5 text-[14px] border border-border bg-background"
            placeholder="https://www.roblox.com/users/123456/profile"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            あなたの Roblox プロフィールページのURL。確認に使います。
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[13px] font-medium">SNSリンク（最大5件・任意）</label>
            {socials.length < 5 ? (
              <button
                type="button"
                onClick={addSocial}
                className="text-[12px] underline"
              >
                + 追加
              </button>
            ) : null}
          </div>
          <ul className="space-y-2">
            {socials.map((s, i) => (
              <li key={i} className="flex gap-2">
                <select
                  value={s.platform}
                  onChange={(e) =>
                    updateSocial(i, { platform: e.target.value as SocialLink['platform'] })
                  }
                  className="px-2 py-1 text-[13px] border border-border bg-background"
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={s.url}
                  onChange={(e) => updateSocial(i, { url: e.target.value })}
                  className="flex-1 px-2 py-1 text-[13px] border border-border bg-background"
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={() => removeSocial(i)}
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-[14px] border border-foreground hover:bg-muted disabled:opacity-40"
        >
          {submitting
            ? '送信中…'
            : creatorId && isVerified
            ? 'プロフィールを更新'
            : creatorId
            ? '内容を更新して新しい確認コードを発行'
            : '登録して確認コードを発行'}
        </button>
      </form>

      {error ? (
        <div className="border border-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-[13px] text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="border border-border bg-muted/30 px-3 py-2 text-[13px]">
          {message}
        </div>
      ) : null}

      {creatorId && code && !isVerified ? (
        <section className="border border-border px-3 py-3">
          <h2 className="text-[13px] font-semibold">確認手順</h2>

          <div className="mt-2 text-[12px] space-y-1">
            <p>
              <strong>STEP 1.</strong> 下の確認コードをコピーします。
            </p>
            <div className="mt-1 mb-2 ml-4">
              <code className="inline-block font-mono text-[14px] px-2 py-1 bg-muted border border-border select-all">
                {code}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(code)}
                className="ml-2 text-[12px] underline"
              >
                コピー
              </button>
            </div>

            <p>
              <strong>STEP 2.</strong> Roblox にログインし、
              <a
                href="https://www.roblox.com/ja/users/profile/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-0.5"
              >
                プロフィール編集ページ
              </a>
              を開きます。
            </p>
            <p className="ml-4 text-muted-foreground">
              （Roblox サイト上で自分のプロフィールを開き、鉛筆アイコン → 「自己紹介」欄からも編集できます）
            </p>

            <p className="mt-2">
              <strong>STEP 3.</strong> 「自己紹介（About）」の入力欄に、コピーしたコードを貼り付けて保存します。
            </p>
            <p className="ml-4 text-muted-foreground">
              文章の途中・末尾どこでも構いません。既存の自己紹介文がある場合は、改行して末尾に追加すればOKです。
            </p>

            <p className="mt-2">
              <strong>STEP 4.</strong> このページに戻って下の「確認する」ボタンを押します。
            </p>
          </div>

          {codeExpires ? (
            <div className="mt-3 text-[11px] text-muted-foreground">
              コードの有効期限：{new Date(codeExpires).toLocaleString('ja-JP')}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="mt-3 px-4 py-1.5 text-[13px] border border-foreground hover:bg-muted disabled:opacity-40"
          >
            {verifying ? '確認中…' : '確認する'}
          </button>

          <p className="mt-3 text-[11px] text-muted-foreground">
            確認できたら、Roblox の自己紹介からこのコードを削除しても認証は維持されます。
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            「コードがまだ反映されていません」と表示される場合、Roblox側の保存反映に1〜2分かかることがあります。少し待ってから再度押してください。
          </p>
        </section>
      ) : null}

      {isVerified && creatorId ? (
        <section className="border border-border px-3 py-3 text-[13px]">
          <p>
            代表作の登録は <a href={`/creators/${creatorId}`} className="underline">プロフィールページ</a>{' '}
            から行えます（実装中：API は <code className="font-mono text-[12px]">POST /api/creators/{creatorId}/games</code>）。
          </p>
        </section>
      ) : null}
    </div>
  );
}
