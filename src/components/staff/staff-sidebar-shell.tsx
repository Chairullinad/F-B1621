"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABELS_ID, type StaffNavItem } from "@/lib/auth";
import type { UserRole } from "@/lib/types/database";
import type { StaffSidebarBadges } from "@/server/inventory";

interface StaffSidebarShellProps {
  staff: {
    fullName: string;
    role: UserRole;
  };
  navItems: ReadonlyArray<StaffNavItem>;
  badges: StaffSidebarBadges;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}

export function StaffSidebarShell({
  staff,
  navItems,
  badges,
  logoutAction,
  children,
}: StaffSidebarShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  // Reset pending indicator saat rute sudah berpindah
  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function isActiveRoute(href: string) {
    if (pendingHref) {
      return pendingHref === href;
    }
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function getBadgeCount(key?: StaffNavItem["badgeKey"]): number {
    if (!key) return 0;
    return badges[key] ?? 0;
  }

  // Pengelompokan Ringkas (Compact Groups)
  const operationalItems = navItems.filter((i) =>
    ["/kasir", "/order-manual", "/dapur", "/antar"].includes(i.href)
  );

  const inventoryItems = navItems.filter((i) =>
    [
      "/dashboard/inventory",
      "/dashboard/opname",
      "/dashboard/transfer-stok",
      "/dashboard/waste",
      "/dashboard/supplier",
    ].includes(i.href)
  );

  const financeAndReportItems = navItems.filter((i) =>
    ["/dashboard", "/dashboard/keuangan"].includes(i.href)
  );

  const isOwner = staff.role === "owner";

  return (
    <div className="flex min-h-screen bg-[#F4F6F8] text-slate-900">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modern Compact Sidebar (#0F1B27 dengan aksen denim #3B7097) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#0F1B27] text-slate-300 shadow-2xl transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header dengan Logo PNG Transparan (Tanpa Bingkai Hitam) */}
        <div className="flex items-center justify-between border-b border-[#1A2E42] px-4 py-3.5">
          <Link
            href={isOwner ? "/dashboard" : navItems[0]?.href ?? "/"}
            prefetch={true}
            onClick={() => {
              setMobileOpen(false);
              setPendingHref(isOwner ? "/dashboard" : navItems[0]?.href ?? "/");
            }}
            className="flex items-center gap-2.5"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <Image
                src="/logo-1621.png"
                alt="f&b1621 Logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold tracking-tight text-[#FAF4EC]">
                f&amp;b1621
              </div>
              <div className="truncate text-[10px] font-semibold text-[#8BB1CE]">
                POS &bull; Inventory &bull; Finance
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#1A2E42] hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Links Terstruktur & Ringkas */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3 text-xs">
          {/* Kelompok 1: Operasional Kasir & KDS */}
          {operationalItems.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-[#6B8EA8] uppercase">
                Operasional Kasir
              </div>
              {operationalItems.map((item) => {
                const active = isActiveRoute(item.href);
                const badge = getBadgeCount(item.badgeKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      setPendingHref(item.href);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                      active
                        ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                        : "text-slate-300 hover:bg-[#162737] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-sm">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge > 0 && (
                      <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Kelompok 2: Inventory & Gudang */}
          {inventoryItems.length > 0 && (
            <div className="space-y-0.5 border-t border-[#1A2E42]/60 pt-2.5">
              <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-[#6B8EA8] uppercase">
                Inventory &amp; Gudang
              </div>
              {inventoryItems.map((item) => {
                const active = isActiveRoute(item.href);
                const badge = getBadgeCount(item.badgeKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      setPendingHref(item.href);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                      active
                        ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                        : "text-slate-300 hover:bg-[#162737] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-sm">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-slate-950">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Kelompok 3: Finansial & Bisnis */}
          {(financeAndReportItems.length > 0 || isOwner) && (
            <div className="space-y-0.5 border-t border-[#1A2E42]/60 pt-2.5">
              <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-[#6B8EA8] uppercase">
                Keuangan &amp; Laporan
              </div>
              {financeAndReportItems.map((item) => {
                const active = isActiveRoute(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      setPendingHref(item.href);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                      active
                        ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                        : "text-slate-300 hover:bg-[#162737] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-sm">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                  </Link>
                );
              })}
              {isOwner && (
                <Link
                  href="/dashboard/transaksi"
                  prefetch={true}
                  onClick={() => {
                    setPendingHref("/dashboard/transaksi");
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                    isActiveRoute("/dashboard/transaksi")
                      ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                      : "text-slate-300 hover:bg-[#162737] hover:text-white"
                  }`}
                >
                  <span className="text-sm">🧾</span>
                  <span className="truncate">Riwayat Transaksi</span>
                </Link>
              )}
            </div>
          )}

          {/* Kelompok 4: Master Data & Pengaturan Outlet (Owner Only) */}
          {isOwner && (
            <div className="space-y-0.5 border-t border-[#1A2E42]/60 pt-2.5">
              <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-[#6B8EA8] uppercase">
                Pengaturan &amp; Master
              </div>
              <Link
                href="/dashboard/pengaturan"
                prefetch={true}
                onClick={() => {
                  setPendingHref("/dashboard/pengaturan");
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                  isActiveRoute("/dashboard/pengaturan")
                    ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                    : "text-slate-300 hover:bg-[#162737] hover:text-white"
                }`}
              >
                <span className="text-sm">⚙️</span>
                <span className="truncate">Pengaturan &amp; Outlet</span>
              </Link>
              <Link
                href="/dashboard/produk"
                prefetch={true}
                onClick={() => {
                  setPendingHref("/dashboard/produk");
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                  isActiveRoute("/dashboard/produk")
                    ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                    : "text-slate-300 hover:bg-[#162737] hover:text-white"
                }`}
              >
                <span className="text-sm">🍛</span>
                <span className="truncate">Menu &amp; Resep</span>
              </Link>
              <Link
                href="/dashboard/meja"
                prefetch={true}
                onClick={() => {
                  setPendingHref("/dashboard/meja");
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                  isActiveRoute("/dashboard/meja")
                    ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                    : "text-slate-300 hover:bg-[#162737] hover:text-white"
                }`}
              >
                <span className="text-sm">🪑</span>
                <span className="truncate">100 Meja &amp; QR</span>
              </Link>
              <Link
                href="/dashboard/staf"
                prefetch={true}
                onClick={() => {
                  setPendingHref("/dashboard/staf");
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                  isActiveRoute("/dashboard/staf")
                    ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                    : "text-slate-300 hover:bg-[#162737] hover:text-white"
                }`}
              >
                <span className="text-sm">👥</span>
                <span className="truncate">Manajemen Staf</span>
              </Link>
              <Link
                href="/dashboard/audit"
                prefetch={true}
                onClick={() => {
                  setPendingHref("/dashboard/audit");
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                  isActiveRoute("/dashboard/audit")
                    ? "bg-[#3B7097] text-[#FAF4EC] shadow-xs"
                    : "text-slate-300 hover:bg-[#162737] hover:text-white"
                }`}
              >
                <span className="text-sm">🛡️</span>
                <span className="truncate">Jejak Audit</span>
              </Link>
            </div>
          )}
        </nav>

        {/* User Footer Profile */}
        <div className="border-t border-[#1A2E42] bg-[#0A131C] px-3.5 py-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-bold text-[#FAF4EC]">
                {staff.fullName}
              </div>
              <div className="truncate text-[10px] text-[#8BB1CE]">
                {ROLE_LABELS_ID[staff.role]} &bull; f&amp;b1621
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg bg-rose-950/60 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-900 hover:text-white transition-colors"
                title="Keluar dari sistem"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar dengan Aksen Denim Blue & Outlet Switcher */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center">
                <Image
                  src="/logo-1621.png"
                  alt="Logo f&b1621"
                  width={28}
                  height={28}
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                f&amp;b1621
              </span>
              <span className="hidden rounded-full bg-[#EBF3F8] px-2.5 py-0.5 text-[11px] font-bold text-[#3B7097] border border-[#C5DAE8] sm:inline-block">
                ⚡ Realtime Connected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Outlet Switcher / Info Cabang */}
            <Link
              href="/dashboard/pengaturan"
              prefetch={true}
              className="group flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#3B7097] hover:bg-[#F3F8FB] transition-colors"
            >
              <span className="text-[#3B7097]">📍</span>
              <span className="truncate max-w-[140px] sm:max-w-none">
                Outlet Utama (100 Meja)
              </span>
              {isOwner && (
                <span className="text-[10px] text-slate-400 group-hover:text-[#3B7097]">
                  ▼
                </span>
              )}
            </Link>

            {(isOwner || staff.role === "cashier") && (
              <Link
                href="/kasir"
                prefetch={true}
                className="hidden items-center gap-1.5 rounded-xl bg-[#3B7097] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2F5B7C] shadow-xs sm:inline-flex transition-colors"
              >
                <span>📱 Kasir POS</span>
                {badges.pending_orders > 0 && (
                  <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-extrabold text-[#3B7097]">
                    {badges.pending_orders}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>

        {/* Content View */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
