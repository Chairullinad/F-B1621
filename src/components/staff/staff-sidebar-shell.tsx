"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABELS_ID, type StaffNavItem } from "@/lib/auth";
import type { UserRole } from "@/lib/types/database";
import type { StaffSidebarBadges } from "@/server/inventory";

const OWNER_MASTER_NAV: ReadonlyArray<{
  href: string;
  label: string;
  icon: string;
}> = [
  { href: "/dashboard/transaksi", label: "Riwayat Transaksi", icon: "🧾" },
  { href: "/dashboard/produk", label: "Menu & Resep (BOM)", icon: "🍛" },
  { href: "/dashboard/kategori", label: "Kategori Menu", icon: "🗂️" },
  { href: "/dashboard/meja", label: "100 Meja & Cetak QR", icon: "🪑" },
  { href: "/dashboard/pengaturan", label: "Pengaturan & QRIS", icon: "⚙️" },
  { href: "/dashboard/staf", label: "Manajemen Staf", icon: "👥" },
  { href: "/dashboard/audit", label: "Jejak Audit SHA-256", icon: "🛡️" },
];

export function StaffSidebarShell({
  staff,
  navItems,
  badges,
  logoutAction,
  children,
}: {
  staff: {
    fullName: string;
    role: UserRole;
  };
  navItems: ReadonlyArray<StaffNavItem>;
  badges: StaffSidebarBadges;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function isActiveRoute(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function getBadgeCount(key?: StaffNavItem["badgeKey"]): number {
    if (!key) return 0;
    return badges[key] ?? 0;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Mobile Backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Fixed Dark Sidebar (#0f172a) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-300 shadow-xl transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <Link
            href={staff.role === "owner" ? "/dashboard" : navItems[0]?.href ?? "/"}
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-extrabold text-white shadow-sm">
              16
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-white">
                f&amp;b1621
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                POS, Inventory &amp; Finance
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Modul Operasional
            </div>
            {navItems.map((item) => {
              const active = isActiveRoute(item.href);
              const badgeCount = getBadgeCount(item.badgeKey);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="w-5 text-center text-base">
                      {item.icon ?? "•"}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badgeCount > 0 ? (
                    <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      {badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {staff.role === "owner" ? (
            <div className="space-y-1 border-t border-slate-800 pt-4">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Master Data &amp; Audit
              </div>
              {OWNER_MASTER_NAV.map((item) => {
                const active = isActiveRoute(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="w-5 text-center text-sm">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </nav>

        {/* User Footer Box */}
        <div className="border-t border-slate-800 bg-slate-950/50 px-5 py-3.5 text-xs">
          <div className="truncate font-bold text-white">{staff.fullName}</div>
          <div className="text-[11px] text-slate-400">
            {ROLE_LABELS_ID[staff.role]} — f&amp;b1621
          </div>
          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="text-[11px] font-semibold text-red-400 transition-colors hover:text-red-300"
            >
              ⎋ Keluar (Logout)
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                f&amp;b1621
              </span>
              <span className="hidden rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 sm:inline-block">
                ✨ Live Realtime System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              📍 Outlet Utama — f&amp;b1621 (100 Meja)
            </div>
            {staff.role === "owner" || staff.role === "cashier" ? (
              <Link
                href="/kasir"
                className="hidden items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 sm:inline-flex"
              >
                <span>📱 Kasir</span>
                {badges.pending_orders > 0 ? (
                  <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-extrabold text-blue-700">
                    {badges.pending_orders}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

