"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tổng quan" },
  { href: "/keystore", label: "Bộ keystore" },
  { href: "/releases", label: "Phát hành & lần chạy" },
  { href: "/builds", label: "Bản build" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/secrets") : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              active ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
