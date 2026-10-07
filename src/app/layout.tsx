import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { isDemoMode } from "@/lib/github";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "CI Console",
  description: "Quản lý secret GitHub Actions cho các app",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-fg">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-fg">CI</span>
              CI Console
            </Link>
            <NavLinks />
            {isDemoMode() && (
              <span className="ml-auto rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">
                Chế độ demo · không gọi GitHub
              </span>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
