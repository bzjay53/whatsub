import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatSub - 유튜브 자막 번역 도우미",
  description: "손쉽게 유튜브 자막을 번역하고 공유하세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-gray-100">
        {children}
      </body>
    </html>
  );
} 