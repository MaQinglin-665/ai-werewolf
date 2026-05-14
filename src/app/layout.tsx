import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "单人 AI 狼人杀",
  description: "一个真人和八个 AI 的 9 人预女猎本地 MVP。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
