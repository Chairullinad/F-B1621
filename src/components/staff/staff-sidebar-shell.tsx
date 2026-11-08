"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  Boxes,
  Receipt,
  Building2,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Store,
  Sparkles,
  Menu as MenuIcon,
  X as CloseIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ROLE_LABELS_ID, type StaffNavItem } from "@/lib/auth";
import type { UserRole } from "@/lib/types/database";
import type { StaffSidebarBadges } from "@/server/inventory";
import { switchActiveOutletAction, type OutletView } from "@/server/outlets";

interface StaffSidebarShellProps {
  staff: {
    fullName: string;
    role: UserRole;
  };
  navItems: ReadonlyArray<StaffNavItem>;
  badges: StaffSidebarBadges;
  outlets?: OutletView[];
  activeOutletId?: string;
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
  icon: React.ReactNode;
  roles: ReadonlyArray<UserRole>;
  items: SubMenuItem[];
}

export function StaffSidebarShell({
  staff,
  badges,
  outlets = [],
  activeOutletId,
  logoutAction,
  children,
}: StaffSidebarShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [outletMenuOpen, setOutletMenuOpen] = React.useState(false);
  const [isSwitchingOutlet, startSwitchTransition] = React.useTransition();

  const [optimisticOutletId, setOptimisticOutletId] = React.useState(activeOutletId);
  React.useEffect(() => {
    setOptimisticOutletId(activeOutletId);
  }, [activeOutletId]);

  const currentOutlet = React.useMemo(() => {
    return (
      outlets.find((o) => o.id === optimisticOutletId) ??
      outlets[0] ?? {
        id: "",
        name: "LATTESPACE",
        description: "Coffee & Eatery",
        themeColor: "#3B7097",
      }
    );
  }, [outlets, optimisticOutletId]);

  const handleSwitchOutlet = (targetId: string) => {
    setOutletMenuOpen(false);
    setOptimisticOutletId(targetId);
    startSwitchTransition(async () => {
      const res = await switchActiveOutletAction(targetId);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        setOptimisticOutletId(activeOutletId);
        toast.error(res.message);
      }
    });
  };

  // Daftar Grup Menu Identik ESB POSLite dengan Ikon Garis Monokrom Minimalis (Bebas Emoji)
  const allGroups: MainMenuGroup[] = React.useMemo(() => {
    return [
      {
        id: "dashboard",
        label: "Beranda",
        icon: <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner"],
        items: [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/stok-menu", label: "Stok Menu" },
          { href: "/dashboard/keuangan", label: "Pembukuan" },
        ],
      },
      {
        id: "operasional",
        label: "Kasir & Pesanan",
        icon: <Smartphone className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner", "cashier", "kitchen", "waiter"],
        items: [
          ...(staff.role === "owner" || staff.role === "cashier"
            ? [
                {
                  href: "/kasir",
                  label: "Layar Kasir, Kitchen & Antar",
                  badgeCount: badges.pending_orders,
                },
                { href: "/order-manual", label: "POS / Order Manual" },
                { href: "/kasir?tab=shift", label: "Tutupan Shift & Struk" },
              ]
            : []),
          ...(staff.role === "kitchen"
            ? [{ href: "/dapur", label: "Layar Kitchen (KDS)" }]
            : []),
          ...(staff.role === "waiter"
            ? [{ href: "/antar", label: "Layar Antar Meja" }]
            : []),
        ],
      },
      {
        id: "menu-kedai",
        label: "Menu & Kedai",
        icon: <Building2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner"],
        items: [
          { href: "/dashboard/produk", label: "Daftar Menu & Kategori" },
          { href: "/dashboard/cabang", label: "Pengaturan Cabang / Kedai" },
          { href: "/dashboard/meja", label: "Meja & QR Code" },
          { href: "/dashboard/pengaturan", label: "Pajak, Service & QRIS" },
        ],
      },
      {
        id: "inventori",
        label: "Inventori & Gudang",
        icon: <Boxes className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
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
                  label: "Stock Opname",
                  badgeCount: badges.pending_opnames,
                },
                {
                  href: "/dashboard/transfer-stok",
                  label: "Transfer Stok",
                  badgeCount: badges.pending_transfers,
                },
                {
                  href: "/dashboard/waste",
                  label: "Barang Rusak (Waste)",
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
        id: "laporan",
        label: "Laporan",
        icon: <Receipt className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner"],
        items: [
          { href: "/dashboard/transaksi", label: "Laporan Penjualan & Struk" },
          { href: "/dashboard/keuangan?tab=labarugi", label: "Laporan Laba Rugi & Pajak" },
        ],
      },
      {
        id: "master",
        label: "Akses & Keamanan",
        icon: <Settings className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner"],
        items: [
          { href: "/dashboard/staf", label: "Kelola Staf & Hak Akses" },
          { href: "/dashboard/audit", label: "Jejak Audit Sistem" },
        ],
      },
    ];
  }, [staff.role, badges]);

  // Filter grup sesuai role pengguna
  const visibleGroups = React.useMemo(() => {
    return allGroups.filter((g) => g.roles.includes(staff.role));
  }, [allGroups, staff.role]);

  // State Accordion: menentukan grup mana yang sedang terbuka (expand)
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of visibleGroups) {
      const hasActive = group.items.some(
        (it) => pathname === it.href || pathname.startsWith(`${it.href}/`)
      );
      initial[group.id] = hasActive;
    }
    if (!Object.values(initial).some(Boolean) && visibleGroups[0]) {
      initial[visibleGroups[0].id] = true;
    }
    return initial;
  });

  // Gunakan ref agar sinkronisasi rute hanya bereaksi terhadap perpindahan pathname (mencegah infinite loop)
  const visibleGroupsRef = React.useRef(visibleGroups);
  React.useEffect(() => {
    visibleGroupsRef.current = visibleGroups;
  }, [visibleGroups]);

  // Sinkronisasi auto-expand saat rute berpindah
  React.useEffect(() => {
    setPendingHref((prev) => (prev !== null ? null : prev));
    for (const group of visibleGroupsRef.current) {
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
  }, [pathname]);

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
    <div className="flex min-h-screen bg-[#F0F3F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modern Light / Dark Clean Sidebar (Identik ESB POSLite) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? "w-18" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header Kiri Atas: Logo 1621Group Horizontal Panjang + Tombol Lipat Sidebar (Persis ESB POSLite) */}
        <div className="flex h-15 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-3.5 py-2 bg-white dark:bg-slate-900">
          <Link
            href={staff.role === "owner" ? "/dashboard" : "/kasir"}
            prefetch={true}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 min-w-0"
          >
            {!sidebarCollapsed ? (
              <div className="relative h-10 w-42 flex items-center">
                <Image
                  src="/logo-1621group.png"
                  alt="1621 Group"
                  width={168}
                  height={47}
                  className="h-full w-auto object-contain object-left"
                  priority
                />
              </div>
            ) : (
              <div className="relative flex h-9 w-10 shrink-0 items-center justify-center">
                <Image
                  src="/logo-1621group-stacked.png"
                  alt="1621 Group"
                  width={40}
                  height={27}
                  className="h-full w-auto object-contain"
                  priority
                />
              </div>
            )}
          </Link>

          {/* Tombol Collapse Sidebar di Dalam Kotak Putih Kiri Atas (Persis ESB POSLite) */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EBF5FF] dark:bg-slate-800 text-[#1E88E5] dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title={sidebarCollapsed ? "Buka Sidebar" : "Lipat Sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 lg:hidden"
            aria-label="Tutup menu"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Accordion: Gaya ESB POSLite Bersih & Minimalis */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 text-[13px]">
          {visibleGroups.map((group) => {
            const isOpen = !!openGroups[group.id];
            const hasActiveChild = group.items.some((it) => isItemActive(it.href));
            const totalGroupBadge = group.items.reduce(
              (acc, it) => acc + (it.badgeCount ?? 0),
              0
            );

            return (
              <div key={group.id} className="mb-1">
                {/* Header Komponen Utama */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  title={group.label}
                  className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all cursor-pointer ${
                    isOpen || hasActiveChild
                      ? "bg-[#EBF5FF] text-[#1E88E5] font-semibold dark:bg-sky-950/50 dark:text-sky-300"
                      : "text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span
                      className={`shrink-0 ${
                        isOpen || hasActiveChild
                          ? "text-[#1E88E5] dark:text-sky-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {group.icon}
                    </span>
                    {!sidebarCollapsed && (
                      <span className="truncate">{group.label}</span>
                    )}
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {totalGroupBadge > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {totalGroupBadge}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-[#1E88E5] dark:text-sky-300" : ""
                        }`}
                      />
                    </div>
                  )}
                </button>

                {/* Sub-item Tanpa Garis Vertikal (Blok Penuh Lembut Persis ESB POSLite) */}
                {isOpen && !sidebarCollapsed && (
                  <div className="mt-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          prefetch={true}
                          onMouseEnter={() => router.prefetch(item.href)}
                          onTouchStart={() => router.prefetch(item.href)}
                          onClick={() => {
                            setPendingHref(item.href);
                            setMobileOpen(false);
                          }}
                          className={`flex items-center justify-between rounded-lg pl-10 pr-3 py-2 text-[13px] transition-all ${
                            active
                              ? "bg-[#EBF5FF] dark:bg-sky-950/60 text-[#1E88E5] dark:text-sky-300 font-semibold"
                              : "text-slate-600 dark:text-slate-400 font-normal hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {(item.badgeCount ?? 0) > 0 && (
                            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white shrink-0">
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
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                  {staff.fullName}
                </div>
                <div className="truncate text-[11px] text-slate-400 dark:text-slate-400">
                  {ROLE_LABELS_ID[staff.role]} &bull; {currentOutlet.name}
                </div>
              </div>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-200 transition-colors cursor-pointer"
                title="Keluar dari sistem"
              >
                <LogOut className="h-3.5 w-3.5" />
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
        {/* Topbar Biru ESB POSLite (#1E88E5) — Bersih di Kiri, Tips Bisnis & User Login di Kanan */}
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-3 bg-[#1E88E5] dark:bg-slate-900 border-b border-transparent dark:border-slate-800 px-4 text-white shadow-xs sm:px-6 transition-colors">
          <div className="flex items-center gap-3">
            {/* Tombol Mobile Toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 lg:hidden"
              aria-label="Buka menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            {/* Logo Mobile (Hanya tampil di layar HP saat sidebar tersembunyi, Warna Asli Tanpa Invert) */}
            <div className="relative h-9 w-20 flex items-center lg:hidden">
              <Image
                src="/logo-1621group-stacked.png"
                alt="1621 Group"
                width={80}
                height={54}
                className="h-full w-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* Sisi Kanan: Tips Bisnis + Theme Toggle + Kartu User Login & Cabang Aktif (Persis ESB POSLite) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Tombol Tips Bisnis di Topbar Biru (Persis ESB POSLite) */}
            <Link
              href="/dashboard#tips-bisnis"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Tips Bisnis</span>
            </Link>

            {/* Filter Mode Gelap & Terang dengan Ikon Bulan 🌙 / Matahari ☀️ */}
            <ThemeToggle />

            {/* Kartu User Login Profile & Cabang Aktif (Pojok Kanan Atas Persis ESB POSLite) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOutletMenuOpen(!outletMenuOpen)}
                className="flex items-center gap-2.5 rounded-xl bg-white/15 hover:bg-white/25 dark:bg-slate-800 text-white px-3 py-1.5 text-xs transition-all border border-white/20 dark:border-slate-700 cursor-pointer"
                title="Profil Pengguna & Pilihan Cabang"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#1E88E5] shadow-2xs">
                  <Store className="h-4 w-4" />
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-semibold leading-tight flex items-center gap-1.5 text-white">
                    <span className="truncate max-w-[140px]">
                      {currentOutlet.name}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-white/80" />
                  </div>
                  <div className="text-[11px] text-white/85 font-normal truncate max-w-[150px] mt-0.5">
                    {staff.fullName}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-white/80 sm:hidden" />
              </button>

              {/* Dropdown Menu Profil & Cabang */}
              {outletMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOutletMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 z-50 w-72 rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Akun Staf Aktif
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {staff.fullName}
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        Role: {ROLE_LABELS_ID[staff.role]}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Pilih Cabang / Outlet
                    </div>

                    <div className="space-y-1">
                      {outlets.map((out) => {
                        const isSelected = out.id === currentOutlet.id;
                        return (
                          <button
                            key={out.id}
                            type="button"
                            onClick={() => handleSwitchOutlet(out.id)}
                            disabled={isSwitchingOutlet}
                            className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${
                              isSelected
                                ? "bg-[#EBF5FF] dark:bg-sky-950/60 text-[#1E88E5] dark:text-sky-300 font-semibold"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <Store className="h-4 w-4 shrink-0 text-slate-400" />
                              <div className="truncate">
                                <div className="truncate font-semibold">{out.name}</div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {out.description || "Cabang 1621 F&B"}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[#1E88E5] dark:text-sky-400 font-bold text-xs">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {staff.role === "owner" && (
                      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                        <Link
                          href="/dashboard/cabang"
                          onClick={() => setOutletMenuOpen(false)}
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          <span>Kelola Cabang &amp; Kustomisasi</span>
                        </Link>
                      </div>
                    )}

                    <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 py-2 text-xs font-semibold transition cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Keluar dari Akun</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
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
