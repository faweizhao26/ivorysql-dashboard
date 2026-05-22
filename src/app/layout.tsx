import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import LogoutButton from "@/components/logout-button";
import LastUpdated from "@/components/LastUpdated";
import NavLinks, { MobileNavLinks } from "@/components/NavLinks";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "IvorySQL 运营数据面板",
  description: "IvorySQL 社区运营数据看板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <ThemeProvider>
          <nav className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center gap-6">
                  <Link href="/" className="flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <span className="text-white font-bold text-sm">I</span>
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100 hidden sm:block">IvorySQL 数据中心</span>
                  </Link>
                  <NavLinks />
                </div>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <span className="text-sm text-slate-400 dark:text-slate-500 hidden sm:block">
                    <LastUpdated />
                  </span>
                  <LogoutButton />
                </div>
              </div>
            </div>
            <MobileNavLinks />
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
