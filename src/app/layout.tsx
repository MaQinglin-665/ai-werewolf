import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 狼人杀",
  description: "支持真人单局、AI 观战和自定义大模型的本地狼人杀 MVP。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
