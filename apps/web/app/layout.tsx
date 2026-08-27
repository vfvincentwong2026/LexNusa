import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexNusa — 印尼法律智能中台",
  description: "面向中国出海企业的中文印尼法规检索：法规搜索、条款阅读、修订状态标注。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
              LexNusa
              <span className="ml-2 text-sm font-normal text-zinc-500">印尼法律智能中台</span>
            </Link>
            <nav className="text-sm text-zinc-600">
              <Link href="/" className="hover:text-accent">
                首页
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 py-6">
          <p className="mx-auto max-w-5xl px-4 text-xs leading-5 text-zinc-500">
            LexNusa 提供的信息仅供参考，不构成法律意见。法规原文数据来自开放法律数据平台 Pasal.id。
          </p>
        </footer>
      </body>
    </html>
  );
}
