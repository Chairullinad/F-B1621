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
  ChevronRight,
  User,
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

  const currentOutlet = React.useMemo(() => {
    return (
      outlets.find((o) => o.id === activeOutletId) ??
      outlets[0] ?? {
        id: "",
        name: "LATTESPACE",
        description: "Coffee & Eatery",
        themeColor: "#3B7097",
      }
    );
  }, [outlets, activeOutletId]);

  const handleSwitchOutlet = (targetId: string) => {
    setOutletMenuOpen(false);
    startSwitchTransition(async () => {
      const res = await switchActiveOutletAction(targetId);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
        window.location.reload();
      } else {
        toast.error(res.message);
      }
    });
  };

  // Daftar 6 Komponen Utama dengan Ikon Garis Monokrom Minimalis (Bebas Emoji)
  const allGroups: MainMenuGroup[] = React.useMemo(() => {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
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
        icon: <Smartphone className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
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
        icon: <Receipt className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner"],
        items: [
          { href: "/dashboard/keuangan", label: "Laporan Keuangan 5 Tab" },
          { href: "/dashboard/transaksi", label: "Riwayat Transaksi & Struk" },
        ],
      },
      {
        id: "cabang",
        label: "Pengaturan Cabang",
        icon: <Building2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
        roles: ["owner"],
        items: [
          { href: "/dashboard/cabang", label: "Kelola & Tambah Cabang" },
        ],
      },
      {
        id: "master",
        label: "Master & Pengaturan",
        icon: <Settings className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />,
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

      {/* Modern Light / Dark Clean Sidebar (bergaya ESB POSLite) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xl transition-all duration-200 lg:translate-x-0 ${
          sidebarCollapsed ? "w-18" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header: Logo 1621Group Stacked PNG Transparan */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 bg-[#FAFBFD] dark:bg-slate-900">
          <Link
            href={staff.role === "owner" ? "/dashboard" : "/kasir"}
            prefetch={true}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 min-w-0"
          >
            {!sidebarCollapsed ? (
              <div className="relative h-11 w-24 flex items-center">
                <Image
                  src="/logo-1621group-stacked.png"
                  alt="1621 Group"
                  width={96}
                  height={65}
                  className="h-full w-auto object-contain dark:brightness-125"
                  priority
                />
              </div>
            ) : (
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <Image
                  src="/logo-1621group-stacked.png"
                  alt="1621 Group"
                  width={32}
                  height={22}
                  className="h-full w-auto object-contain"
                  priority
                />
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 lg:hidden"
            aria-label="Tutup menu"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Accordion: Komponen Utama + Sub-item Expandable */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3 text-xs">
          {visibleGroups.map((group) => {
            const isOpen = !!openGroups[group.id];
            const totalGroupBadge = group.items.reduce(
              (acc, it) => acc + (it.badgeCount ?? 0),
              0
            );

            return (
              <div key={group.id} className="mb-1 rounded-xl">
                {/* Header Komponen Utama dengan Ikon Monokrom */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  title={group.label}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-bold transition-all ${
                    isOpen
                      ? "text-[#3B7097] bg-[#F3F7FA] dark:bg-slate-800 dark:text-sky-300"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="shrink-0">{group.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="truncate text-xs font-semibold">{group.label}</span>
                    )}
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {totalGroupBadge > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                          {totalGroupBadge}
                        </span>
                      )}
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-90 text-[#3B7097] dark:text-sky-300" : ""
                        }`}
                      />
                    </div>
                  )}
                </button>

                {/* Sub-item yang Tersembunyi (Expandable) dengan Background Instant Prefetching */}
                {isOpen && !sidebarCollapsed && (
                  <div className="mt-1 space-y-0.5 pl-6 pr-1 border-l-2 border-[#DCE6ED] dark:border-slate-800 ml-4 animate-in fade-in slide-in-from-top-1 duration-150">
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
                          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all ${
                            active
                              ? "bg-[#EBF3F8] dark:bg-sky-950/60 text-[#3B7097] dark:text-sky-300 font-bold shadow-2xs"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
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
        <div className="border-t border-slate-200 dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-900 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="truncate font-bold text-slate-900 dark:text-slate-100">
                  {staff.fullName}
                </div>
                <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {ROLE_LABELS_ID[staff.role]} &bull; 1621F&amp;B
                </div>
              </div>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-200 transition-colors"
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
        {/* Full-Width Topbar Biru Penuh (#3B7097 bergaya ESB POSLite / Dark Mode Slate-900) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-[#3B7097] dark:bg-slate-900 border-b border-transparent dark:border-slate-800 px-4 text-white shadow-md sm:px-6 transition-colors">
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

            {/* Tombol Collapse Desktop Sidebar */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white hover:bg-white/20 lg:inline-flex transition-colors"
              title={sidebarCollapsed ? "Buka Sidebar" : "Lipat Sidebar"}
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform duration-200 ${
                  sidebarCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>

            {/* Logo Brand Stacked di Topbar */}
            <div className="flex items-center gap-2.5">
              <div className="relative h-10 w-20 flex items-center">
                <Image
                  src="/logo-1621group-stacked.png"
                  alt="1621 Group"
                  width={80}
                  height={54}
                  className="h-full w-auto object-contain brightness-0 invert drop-shadow-xs"
                  priority
                />
              </div>
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white border border-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <span>Multi-Outlet F&amp;B</span>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Theme Toggle + Kartu User Login Profile Murni (Sesuai Referensi ESB POSLite) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Filter Mode Gelap & Terang dengan Ikon Bulan 🌙 / Matahari ☀️ */}
            <ThemeToggle />

            {/* Master Account Badge Khusus Owner (Minimalis Monokrom) */}
            {staff.role === "owner" && (
              <div className="hidden xl:flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-2.5 py-1 text-[11px] font-bold text-blue-100">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>MASTER</span>
              </div>
            )}

            {/* Kartu User Login Profile & Cabang Aktif (Pojok Kanan Murni) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOutletMenuOpen(!outletMenuOpen)}
                className="flex items-center gap-2.5 rounded-xl bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 px-3 py-1.5 text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all border border-slate-200/80 dark:border-slate-700 cursor-pointer"
                title="Profil Pengguna & Pilihan Cabang"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3B7097]/10 dark:bg-sky-500/20 text-[#3B7097] dark:text-sky-300">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-bold leading-tight flex items-center gap-1">
                    <span className="truncate max-w-[130px] font-semibold text-slate-900 dark:text-slate-100">
                      {currentOutlet.name}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px]">
                    {staff.fullName}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 sm:hidden" />
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
                      <div className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">
                        Masuk Sebagai
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {staff.fullName}
                      </div>
                      <div className="text-2xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        Role: {ROLE_LABELS_ID[staff.role]}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 text-2xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Pilih Cabang Aktif
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
                            className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                              isSelected
                                ? "bg-[#EBF3F8] dark:bg-sky-950/60 text-[#3B7097] dark:text-sky-300 font-bold"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <Store className="h-4 w-4 shrink-0 text-slate-400" />
                              <div className="truncate">
                                <div className="truncate font-bold">{out.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {out.description || "Cabang 1621 F&B"}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[#3B7097] dark:text-sky-400 font-extrabold text-xs">✓</span>
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
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
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
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 py-2 text-xs font-bold transition"
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
