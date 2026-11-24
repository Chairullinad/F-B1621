import type { UserRole } from "./types/database.ts";

/**
 * src/lib/auth.ts
 * Aturan pengalihan rute dan matriks hak akses per role (PRD Bagian 3 & 5.1):
 * - owner   -> /dashboard (memiliki akses ke Dashboard + semua layar)
 * - cashier -> /kasir (memiliki akses ke Layar Kasir, Order Manual, dan Struk)
 * - kitchen -> /dapur (memiliki akses ke Layar Dapur)
 * - waiter  -> /antar (memiliki akses ke Layar Antar)
 * - Pelanggan mengakses /m/[token] tanpa login.
 */

export const ROLE_LABELS_ID: Record<UserRole, string> = {
  owner: "Owner",
  cashier: "Kasir",
  warehouse: "Staff Gudang",
  kitchen: "Kitchen",
  waiter: "Pelayan",
};

export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  owner: "/dashboard",
  cashier: "/kasir",
  warehouse: "/dashboard/inventory",
  kitchen: "/dapur",
  waiter: "/antar",
};

export interface StaffNavItem {
  href: string;
  label: string;
  icon?: string;
  badgeKey?: "pending_orders" | "pending_opnames" | "pending_transfers" | "low_stock";
  allowedRoles: ReadonlyArray<UserRole>;
}

export const STAFF_NAV_ITEMS: ReadonlyArray<StaffNavItem> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "📊",
    allowedRoles: ["owner"],
  },
  {
    href: "/dashboard/keuangan",
    label: "Laporan Keuangan",
    icon: "💰",
    allowedRoles: ["owner"],
  },
  {
    href: "/kasir",
    label: "Pesanan Meja & Kasir",
    icon: "📱",
    badgeKey: "pending_orders",
    allowedRoles: ["owner", "cashier"],
  },
  {
    href: "/order-manual",
    label: "POS / Order Manual",
    icon: "🛒",
    allowedRoles: ["owner", "cashier"],
  },
  {
    href: "/dapur",
    label: "Kitchen Display (KDS)",
    icon: "🍳",
    allowedRoles: ["owner", "kitchen"],
  },
  {
    href: "/antar",
    label: "Layar Antar Meja",
    icon: "🍽️",
    allowedRoles: ["owner", "waiter"],
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory Bahan Baku",
    icon: "📦",
    badgeKey: "low_stock",
    allowedRoles: ["owner", "warehouse", "cashier"],
  },
  {
    href: "/dashboard/opname",
    label: "Stock Opname",
    icon: "🔍",
    badgeKey: "pending_opnames",
    allowedRoles: ["owner", "warehouse"],
  },
  {
    href: "/dashboard/transfer-stok",
    label: "Transfer Stok",
    icon: "🚚",
    badgeKey: "pending_transfers",
    allowedRoles: ["owner", "warehouse", "cashier"],
  },
  {
    href: "/dashboard/waste",
    label: "Waste Tracking",
    icon: "🗑️",
    allowedRoles: ["owner", "warehouse"],
  },
  {
    href: "/dashboard/supplier",
    label: "Supplier & PO",
    icon: "🏭",
    allowedRoles: ["owner", "warehouse", "cashier"],
  },
];

export function getDefaultRouteForRole(role: UserRole): string {
  return ROLE_DEFAULT_ROUTE[role];
}

export function isPublicPathname(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }
  if (pathname.startsWith("/m/")) {
    return true;
  }
  return false;
}

/**
 * Rute yang boleh diakses Owner saat belum masuk ke salah satu kios (Mode Holding):
 * - /dashboard (pilihan kios & grafik penjualan per bulan tiap usaha)
 * - /dashboard/keuangan (laporan keuangan & laba rugi konsolidasi / per kios)
 * - /dashboard/transaksi (laporan penjualan & struk konsolidasi / per kios)
 * - /dashboard/cabang (Setting Kios: nama usaha, logo usaha, detail usaha)
 * - /dashboard/staf (kelola staf & hak akses lintas cabang)
 * - /dashboard/audit (jejak audit sistem konsolidasi / per kios)
 */
export function canOwnerAccessWithoutOutlet(pathname: string): boolean {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (
    normalized === "/dashboard" ||
    normalized === "/dashboard/keuangan" ||
    normalized.startsWith("/dashboard/keuangan/") ||
    normalized === "/dashboard/transaksi" ||
    normalized.startsWith("/dashboard/transaksi/") ||
    normalized === "/dashboard/cabang" ||
    normalized.startsWith("/dashboard/cabang/") ||
    normalized === "/dashboard/landing-page" ||
    normalized.startsWith("/dashboard/landing-page/") ||
    normalized === "/dashboard/staf" ||
    normalized.startsWith("/dashboard/staf/") ||
    normalized === "/dashboard/audit" ||
    normalized.startsWith("/dashboard/audit/")
  );
}

export function isStaffProtectedPathname(pathname: string): boolean {
  return (
    pathname === "/kasir" ||
    pathname.startsWith("/kasir/") ||
    pathname === "/order-manual" ||
    pathname.startsWith("/order-manual/") ||
    pathname === "/dapur" ||
    pathname.startsWith("/dapur/") ||
    pathname === "/antar" ||
    pathname.startsWith("/antar/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/struk/")
  );
}

export function canRoleAccessPathname(
  role: UserRole,
  pathname: string
): boolean {
  if (isPublicPathname(pathname)) {
    return true;
  }

  if (role === "owner") {
    return true;
  }

  if (
    pathname === "/kasir" ||
    pathname.startsWith("/kasir/") ||
    pathname === "/order-manual" ||
    pathname.startsWith("/order-manual/") ||
    pathname.startsWith("/struk/")
  ) {
    return role === "cashier";
  }

  if (pathname === "/dapur" || pathname.startsWith("/dapur/")) {
    return role === "kitchen";
  }

  if (pathname === "/antar" || pathname.startsWith("/antar/")) {
    return role === "waiter";
  }

  if (
    pathname === "/dashboard/inventory" ||
    pathname.startsWith("/dashboard/inventory/") ||
    pathname === "/dashboard/transfer-stok" ||
    pathname.startsWith("/dashboard/transfer-stok/") ||
    pathname === "/dashboard/supplier" ||
    pathname.startsWith("/dashboard/supplier/")
  ) {
    return role === "warehouse" || role === "cashier";
  }

  if (
    pathname === "/dashboard/opname" ||
    pathname.startsWith("/dashboard/opname/") ||
    pathname === "/dashboard/waste" ||
    pathname.startsWith("/dashboard/waste/")
  ) {
    return role === "warehouse";
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return false;
  }

  return true;
}

export function getNavItemsForRole(
  role: UserRole
): ReadonlyArray<StaffNavItem> {
  return STAFF_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
}

