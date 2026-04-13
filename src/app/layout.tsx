import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AuthProvider } from "./auth-provider";
import LogoutButton from "@/components/logout-button";

export const metadata: Metadata = {
  title: "IvorySQL 运营数据面板",
  description: "IvorySQL 社区运营数据看板",
};

const navItems = [
  { href: "/", label: "🏠 首页" },
  { href: "/github", label: "📊 GitHub" },
  { href: "/social", label: "📱 社媒" },
  { href: "/content", label: "📝 内容" },
  { href: "/website", label: "🌐 官网" },
  { href: "/events", label: "📅 活动" },
  { href: "/admin", label: "⚙️ 管理" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="light">
      <body className="min-h-screen bg-gray-100">
        <AuthProvider>
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center gap-6">
                  <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">I</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900">IvorySQL 数据中心</span>
                  </Link>
                  <div className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">
                    最后更新: {new Date().toLocaleDateString('zh-CN')}
                  </span>
                  <LogoutButton />
                </div>
              </div>
            </div>
            <div className="md:hidden border-t border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}