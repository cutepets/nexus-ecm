"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { useAuthStore } from "@/stores/auth-store";
import { useCompanyBranding } from "@/features/settings/api";

export function Sidebar() {
  const pathname = usePathname();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data: branding } = useCompanyBranding();

  const items = NAV_ITEMS.filter(
    (i) => !i.permission || hasPermission(i.permission),
  );

  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-60 flex-col border-r border-border bg-card md:flex">
      <Link
        href="/dashboard"
        className="flex h-16 min-w-0 items-center gap-3 px-5"
      >
        {branding?.logoUrl ? (
          <Image
            src={branding.logoUrl}
            alt=""
            width={36}
            height={36}
            sizes="36px"
            className="size-9 shrink-0 rounded-xl border border-border bg-card object-contain"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white">
            {(branding?.companyName ?? "N").trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate text-lg font-semibold tracking-tight">
          {branding?.companyName ?? "Nexus ECM"}
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          // Dashboard root must match exactly; modules match by prefix.
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-canvas font-medium text-ink"
                  : "text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3 text-xs text-ink-subtle">
        Quản lý chấm công
      </div>
    </aside>
  );
}
