import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import LogoutButton from "@/components/logout-button";

export const metadata: Metadata = {
  title: "IvorySQL 运营数据面板",
  description: "IvorySQL 社区运营数据看板",
};

const navItems = [
  { href: "/", label: "🏠", name: "首页" },
  { href: "/github", label: "📊", name: "GitHub" },
  { href: "/social", label: "📱", name: "社媒" },
  { href: "/content", label: "📝", name: "内容" },
  { href: "/website", label: "🌐", name: "官网" },
  { href: "/events", label: "📅", name: "活动" },
  { href: "/admin", label: "⚙️", name: "管理" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body className="min-h-screen bg-background">
        <nav className="bg-[#0f172a] border-b border-[#334155] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <span className="text-white font-bold text-sm">I</span>
                  </div>
                  <span className="text-lg font-bold text-primary hidden sm:block">IvorySQL 数据中心</span>
                </Link>
                <div className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="nav-link px-3 py-2 text-sm font-medium rounded-lg hover:bg-[#1e293b] flex items-center gap-1.5"
                    >
                      <span>{item.label}</span>
                      <span className="hidden lg:inline">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted hidden sm:block">
                  最后更新: {new Date().toLocaleDateString('zh-CN')}
                </span>
                <LogoutButton />
              </div>
            </div>
          </div>
          <div className="md:hidden border-t border-[#334155] px-4 py-2 flex gap-2 overflow-x-auto scrollbar-thin">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap flex items-center gap-1"
              >
                <span>{item.label}</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}