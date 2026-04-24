import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FeedbackFab } from "@/components/FeedbackFab";

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
  title: "Roblox Japan Ranking",
  description: "日本語圏向けRobloxゲームのリアルタイムCCUランキング",
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
      <body className="antialiased min-h-screen bg-background">
        <SiteHeader />
        {children}
        <SiteFooter />
        <FeedbackFab />
      </body>
    </html>
  );
}
