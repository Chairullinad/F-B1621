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

interface SubMenuItem {
  href: string;
  label: string;
  badgeCount?: number;
}

interface MainMenuGroup {
  id: string;
  label: string;
  icon: string;
  roles: ReadonlyArray<UserRole>;
  items: SubMenuItem[];
}

export function StaffSidebarShell({
  staff,
  badges,
  logoutAction,
  children,
}: StaffSidebarShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  // Daftar 6 Komponen Utama dengan Sub-item yang disembunyikan dalam Expand/Accordion
  const allGroups: MainMenuGroup[] = React.useMemo(() => {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "📊",
        roles: ["owner"],
        items: [
          { href: "/dashboard", label: "Ringkasan Utama" },
          { href: "/dashboard/stok-menu", label: "Stok Menu" },
          { href: "/dashboard/produk", label: "Master Menu & Harga" },
        ],
      },
      {
        id: "operasional",
        label: "Kasir & Pesanan",
        icon: "📱",
        roles: ["owner", "cashier", "kitchen", "waiter"],
        items: [
          ...(staff.role === "owner" || staff.role === "cashier"
            ? [
                {
                  href: "/kasir",
                  label: "Layar Kasir Meja",
                  badgeCount: badges.pending_orders,
                },
                { href: "/order-manual", label: "POS / Order Manual" },
              ]
            : []),
          ...(staff.role === "owner" || staff.role === "kitchen"
            ? [{ href: "/dapur", label: "Layar Dapur (KDS)" }]
            : []),
          ...(staff.role === "owner" || staff.role === "waiter"
            ? [{ href: "/antar", label: "Layar Antar Meja" }]
            : []),
        ],
      },
      {
        id: "inventori",
        label: "Inventori & Gudang",
        icon: "📦",
        roles: ["owner", "warehouse", "cashier"],
        items: [
          {
            href: "/dashboard/inventory",
            label: "Bahan Baku & Resep BOM",
            badgeCount: badges.low_stock,
          },
          ...(staff.role === "owner" || staff.role === "warehouse"
            ? [
                {
                  href: "/dashboard/opname",
                  label: "Stock Opname (Blind Count)",
                  badgeCount: badges.pending_opnames,
                },
                {
                  href: "/dashboard/transfer-stok",
                  label: "Transfer Stok Antar Lokasi",
                  badgeCount: badges.pending_transfers,
                },
                {
                  href: "/dashboard/waste",
                  label: "Waste & Spoilage Tracking",
                },
                {
                  href: "/dashboard/supplier",
                  label: "Supplier & Purchase Order",
                },
              ]
            : [
                {
                  href: "/dashboard/transfer-stok",
                  label: "Transfer Stok",
                  badgeCount: badges.pending_transfers,
                },
                {
                  href: "/dashboard/supplier",
                  label: "Cek Supplier",
                },
              ]),
        ],
      },
      {
        id: "keuangan",
        label: "Laporan & Keuangan",
        icon: "💰",
        roles: ["owner"],
        items: [
          { href: "/dashboard/keuangan", label: "Laporan Keuangan 5 Tab" },
          { href: "/dashboard/transaksi", label: "Riwayat Transaksi & Struk" },
        ],
      },
      {
        id: "cabang",
        label: "Pengaturan Cabang",
        icon: "🏢",
        roles: ["owner"],
        items: [
          { href: "/dashboard/cabang", label: "Kelola & Tambah Cabang" },
        ],
      },
      {
        id: "master",
        label: "Master & Pengaturan",
        icon: "⚙️",
        roles: ["owner"],
        items: [
          { href: "/dashboard/pengaturan", label: "Pajak, Service & QRIS" },
          { href: "/dashboard/meja", label: "100 Meja & Cetak QR" },
          { href: "/dashboard/staf", label: "Hak Akses & Staf" },
          { href: "/dashboard/audit", label: "Pembukuan & Jejak Audit" },
        ],
      },
    ];
  }, [staff.role, badges]);

  // Filter grup sesuai role pengguna (dimemoize agar referensi array stabil)
  const visibleGroups = React.useMemo(() => {
    return allGroups.filter((g) => g.roles.includes(staff.role));
  }, [allGroups, staff.role]);

  // State Accordion: menentukan grup mana yang sedang terbuka (expand)
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of visibleGroups) {
      // Buka otomatis grup yang memuat rute aktif saat ini
      const hasActive = group.items.some(
        (it) => pathname === it.href || pathname.startsWith(`${it.href}/`)
      );
      initial[group.id] = hasActive;
    }
    // Jika tidak ada yang cocok, buka grup pertama
    if (!Object.values(initial).some(Boolean) && visibleGroups[0]) {
      initial[visibleGroups[0].id] = true;
    }
    return initial;
  });

  // Sinkronisasi auto-expand saat rute berpindah (hanya perbarui state jika belum aktif)
  React.useEffect(() => {
    setPendingHref(null);
    for (const group of visibleGroups) {
      const hasActive = group.items.some(
        (it) => pathname === it.href || pathname.startsWith(`${it.href}/`)
      );
      if (hasActive) {
        setOpenGroups((prev) => {
          if (prev[group.id]) return prev;
          return { ...prev, [group.id]: true };
        });
      }
    }
  }, [pathname, visibleGroups]);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  function isItemActive(href: string) {
    if (pendingHref) {
      return pendingHref === href;
    }
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-screen bg-[#F0F3F7] text-slate-900">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modern Light Clean Sidebar (#FFFFFF bergaya ESB POSLite) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white text-slate-800 shadow-xl transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? "w-18" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header */}
        <div className="flex h-15 items-center justify-between border-b border-slate-200 px-4 py-3 bg-[#FAFBFD]">
          <Link
            href={staff.role === "owner" ? "/dashboard" : "/kasir"}
            prefetch={true}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <Image
                src="/logo-1621.png"
                alt="Logo 1621F&B"
                width={36}
                height={36}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold tracking-tight text-[#0F1B27]">
                  1621F&amp;B
                </div>
                <div className="truncate text-[10px] font-semibold text-[#3B7097]">
                  POSLite &bull; F&amp;B System
                </div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Accordion: Komponen Utama + Sub-item Expandable */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3 text-xs">
          {visibleGroups.map((group) => {
            const isOpen = !!openGroups[group.id];
            // Hitung total badge di dalam grup untuk ditampilkan saat accordion tertutup
            const totalGroupBadge = group.items.reduce(
              (acc, it) => acc + (it.badgeCount ?? 0),
              0
            );

            return (
              <div key={group.id} className="mb-1 rounded-xl">
                {/* Header Komponen Utama */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  title={group.label}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-bold transition-all ${
                    isOpen
                      ? "text-[#3B7097] bg-[#F3F7FA]"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base shrink-0">{group.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="truncate text-xs">{group.label}</span>
                    )}
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {totalGroupBadge > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                          {totalGroupBadge}
                        </span>
                      )}
                      <span
                        className={`text-[10px] text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-90 text-[#3B7097]" : ""
                        }`}
                      >
                        ▶
                      </span>
                    </div>
                  )}
                </button>

                {/* Sub-item yang Tersembunyi (Expandable) */}
                {isOpen && !sidebarCollapsed && (
                  <div className="mt-1 space-y-0.5 pl-6 pr-1 border-l-2 border-[#DCE6ED] ml-4 animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          prefetch={true}
                          onClick={() => {
                            setPendingHref(item.href);
                            setMobileOpen(false);
                          }}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all ${
                            active
                              ? "bg-[#EBF3F8] text-[#3B7097] font-bold shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {(item.badgeCount ?? 0) > 0 && (
                            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-extrabold text-white shrink-0">
                              {item.badgeCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-slate-200 bg-[#FAFBFD] p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="truncate font-bold text-slate-900">
                  {staff.fullName}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {ROLE_LABELS_ID[staff.role]} &bull; 1621F&amp;B
                </div>
              </div>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                title="Keluar dari sistem"
              >
                ⎋
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ${
          sidebarCollapsed ? "lg:pl-18" : "lg:pl-64"
        }`}
      >
        {/* Full-Width Topbar Biru Penuh (#3B7097 bergaya ESB POSLite) */}
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-3 bg-[#3B7097] px-4 text-white shadow-md sm:px-6">
          <div className="flex items-center gap-3">
            {/* Tombol Mobile Toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 lg:hidden"
              aria-label="Buka menu"
            >
              ☰
            </button>

            {/* Tombol Collapse Desktop Sidebar <| */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white hover:bg-white/20 lg:inline-flex transition-colors"
              title={sidebarCollapsed ? "Buka Sidebar" : "Lipat Sidebar"}
            >
              {sidebarCollapsed ? "▶|" : "◀|"}
            </button>

            {/* Logo Brand di Topbar */}
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight sm:text-lg">
                1621F&amp;B
              </span>
              <span className="hidden rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white border border-white/20 sm:inline-block">
                ⚡ Live Cloud Connected
              </span>
            </div>
          </div>

          {/* Sisi Kanan: Kartu Cabang & Profil Staf (Persis Latte Space Boyolali) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Kartu Cabang Aktif + User Profil */}
            <Link
              href="/dashboard/cabang"
              prefetch={true}
              className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-all border border-white/15"
              title="Klik untuk kelola cabang"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-800 font-extrabold text-xs shadow-2xs">
                🏢
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-xs font-bold leading-tight">
                  Outlet Utama (100 Meja)
                </div>
                <div className="text-[10px] text-blue-100 font-medium">
                  {staff.fullName} ({ROLE_LABELS_ID[staff.role]})
                </div>
              </div>
              <span className="text-[10px] text-white/70">▼</span>
            </Link>

            {/* Tombol Cepat Kasir */}
            {(staff.role === "owner" || staff.role === "cashier") && (
              <Link
                href="/kasir"
                prefetch={true}
                className="hidden items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#3B7097] hover:bg-blue-50 shadow-sm sm:inline-flex transition-colors"
              >
                <span>📱 Kasir POS</span>
                {badges.pending_orders > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
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
