import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FeedbackFab } from "@/components/FeedbackFab";

const ADSENSE_CLIENT_ID = 'ca-pub-5811589837476935';

/**
 * 日本語ファースト設計のため、本文フォントは Noto Sans JP を採用。
 * - subsets: "latin" のみ（日本語はGoogle Fontsが自動サブセット配信）
 * - weight: 400(本文) / 500(中強調) / 700(見出し) の3段階
 * - display: "swap"（CLSを最小化、フォント読み込み中もレイアウトは確定）
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ro-brojp.com'),
  title: {
    default: 'ro-brojp — 日本人向け Roblox 発見サイト',
    template: '%s | ro-brojp',
  },
  description: '日本語圏向け Roblox ゲームのリアルタイム CCU ランキング・タグ・配信ネタ・クリエイター発見サイト',
};

/**
 * モバイル最優先のためviewportを明示。
 * maximum-scaleは指定しない（アクセシビリティのため拡大を許可）。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={cn("font-sans", notoSansJP.variable)}>
      <head>
        {/* Google AdSense（フェーズ12 §6 / 審査用 + 配信用兼用スニペット） */}
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased min-h-screen bg-background">
        <Script
          id="ld-organization"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'ro-brojp',
              alternateName: '日本人向け Roblox 発見サイト',
              url: 'https://ro-brojp.com',
              inLanguage: 'ja',
              description:
                '日本語圏向け Roblox ゲームのリアルタイム CCU ランキング・タグ・配信ネタ・クリエイター発見サイト',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://ro-brojp.com/search?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <SiteHeader />
        {children}
        <SiteFooter />
        <FeedbackFab />
      </body>
    </html>
  );
}
