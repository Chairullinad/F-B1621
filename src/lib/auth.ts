import type {
  PermissionKey,
  UserCustomPermissions,
  UserRole,
} from "./types/database.ts";

/**
 * src/lib/auth.ts
 * Aturan pengalihan rute dan matriks hak akses per role & per user (PRD Bagian 3 & 5.1):
 * - owner   -> /dashboard (memiliki akses ke Dashboard + semua layar)
 * - cashier -> /kasir (memiliki akses ke Layar Kasir, Order Manual, dan Struk)
 * - kitchen -> /dapur (memiliki akses ke Layar Dapur)
 * - waiter  -> /antar (memiliki akses ke Layar Antar)
 * - Pelanggan mengakses /m/[token] tanpa login.
 */

export interface PermissionDefinition {
  key: PermissionKey;
  module: string;
  label: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: ReadonlyArray<PermissionDefinition> = [
  {
    key: "dashboard",
    module: "Beranda",
    label: "Dashboard & Stok Menu",
    description: "Melihat ringkasan grafik penjualan outlet & status stok menu.",
  },
  {
    key: "keuangan",
    module: "Laporan & Akuntansi",
    label: "Pembukuan, Arus Kas, Laba Rugi & Pajak",
    description: "Mengakses Arus Kas, Jurnal Umum, Laba Rugi, Neraca & Rekap Pajak.",
  },
  {
    key: "transaksi",
    module: "Laporan & Akuntansi",
    label: "Laporan Penjualan & Riwayat Struk",
    description: "Melihat seluruh riwayat transaksi, refund & cetak ulang struk.",
  },
  {
    key: "kasir",
    module: "Kasir & Pesanan",
    label: "Layar Kasir, Verifikasi QRIS & Tutupan Shift",
    description: "Menerima pembayaran, revisi order pending, diskon, & tutup shift.",
  },
  {
    key: "order_manual",
    module: "Kasir & Pesanan",
    label: "POS / Order Manual",
    description: "Membuat pesanan langsung dari kasir untuk dine-in maupun takeaway.",
  },
  {
    key: "dapur",
    module: "Kitchen & Antar",
    label: "Layar Kitchen (KDS)",
    description: "Mengelola antrean masak dapur (Baru -> Mulai Masak -> Siap Saji).",
  },
  {
    key: "antar",
    module: "Kitchen & Antar",
    label: "Layar Antar Meja",
    description: "Mengambil pesanan siap saji (READY) dan menandai sudah diantar (SERVED).",
  },
  {
    key: "menu_kedai",
    module: "Menu & Kedai",
    label: "Kelola Menu, Kategori, Meja QR & Landing Page",
    description: "Mengedit daftar produk, harga, kategori, QR meja & banner landing.",
  },
  {
    key: "inventory",
    module: "Inventori & Gudang",
    label: "Bahan Baku, Resep (BOM) & Transfer Stok",
    description: "Mengelola master bahan baku, resep produk, dan mutasi stok antar lokasi.",
  },
  {
    key: "opname_waste",
    module: "Inventori & Gudang",
    label: "Stock Opname & Barang Rusak (Waste)",
    description: "Melakukan input stock opname (blind count) dan pencatatan waste.",
  },
  {
    key: "supplier_po",
    module: "Inventori & Gudang",
    label: "Supplier & Purchase Order (PO)",
    description: "Mengelola data supplier, pembuatan PO, dan penerimaan barang masuk.",
  },
  {
    key: "pengaturan",
    module: "Pengaturan",
    label: "Pengaturan Pajak, QRIS, Cabang & Notifikasi",
    description: "Mengubah profil cabang, pajak/service, QRIS, & notifikasi email.",
  },
  {
    key: "staf_audit",
    module: "Akses & Keamanan",
    label: "Kelola Staf, Hak Akses & Jejak Audit",
    description: "Mengelola akun staf, hak akses per user, dan meninjau jejak audit.",
  },
];

export const ALL_PERMISSION_KEYS: ReadonlyArray<PermissionKey> =
  PERMISSION_DEFINITIONS.map((p) => p.key);

export const ROLE_DEFAULT_PERMISSIONS: Record<
  UserRole,
  Readonly<Record<PermissionKey, boolean>>
> = {
  owner: {
    dashboard: true,
    keuangan: true,
    transaksi: true,
    kasir: true,
    order_manual: true,
    dapur: true,
    antar: true,
    menu_kedai: true,
    inventory: true,
    opname_waste: true,
    supplier_po: true,
    pengaturan: true,
    staf_audit: true,
  },
  cashier: {
    dashboard: false,
    keuangan: false,
    transaksi: false,
    kasir: true,
    order_manual: true,
    dapur: false,
    antar: false,
    menu_kedai: false,
    inventory: true,
    opname_waste: false,
    supplier_po: true,
    pengaturan: false,
    staf_audit: false,
  },
  warehouse: {
    dashboard: false,
    keuangan: false,
    transaksi: false,
    kasir: false,
    order_manual: false,
    dapur: false,
    antar: false,
    menu_kedai: false,
    inventory: true,
    opname_waste: true,
    supplier_po: true,
    pengaturan: false,
    staf_audit: false,
  },
  kitchen: {
    dashboard: false,
    keuangan: false,
    transaksi: false,
    kasir: false,
    order_manual: false,
    dapur: true,
    antar: false,
    menu_kedai: false,
    inventory: false,
    opname_waste: false,
    supplier_po: false,
    pengaturan: false,
    staf_audit: false,
  },
  waiter: {
    dashboard: false,
    keuangan: false,
    transaksi: false,
    kasir: false,
    order_manual: false,
    dapur: false,
    antar: true,
    menu_kedai: false,
    inventory: false,
    opname_waste: false,
    supplier_po: false,
    pengaturan: false,
    staf_audit: false,
  },
};

export function sanitizeCustomPermissions(
  raw: unknown
): UserCustomPermissions | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const cleaned: UserCustomPermissions = {};
  let hasEntry = false;
  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof source[key] === "boolean") {
      cleaned[key] = source[key];
      hasEntry = true;
    }
  }
  return hasEntry ? cleaned : null;
}

export function hasUserPermission(
  role: UserRole,
  customPermissions: UserCustomPermissions | null | undefined,
  permission: PermissionKey
): boolean {
  if (role === "owner") {
    return true;
  }
  if (customPermissions && typeof customPermissions[permission] === "boolean") {
    return customPermissions[permission];
  }
  return ROLE_DEFAULT_PERMISSIONS[role][permission];
}

export function getEffectivePermissions(
  role: UserRole,
  customPermissions?: UserCustomPermissions | null
): Record<PermissionKey, boolean> {
  const result = {} as Record<PermissionKey, boolean>;
  for (const key of ALL_PERMISSION_KEYS) {
    result[key] = hasUserPermission(role, customPermissions, key);
  }
  return result;
}

export function getRequiredPermissionForPathname(
  pathname: string
): PermissionKey | null {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (
    normalized === "/kasir" ||
    normalized.startsWith("/kasir/") ||
    normalized.startsWith("/struk/")
  ) {
    return "kasir";
  }
  if (
    normalized === "/order-manual" ||
    normalized.startsWith("/order-manual/")
  ) {
    return "order_manual";
  }
  if (normalized === "/dapur" || normalized.startsWith("/dapur/")) {
    return "dapur";
  }
  if (normalized === "/antar" || normalized.startsWith("/antar/")) {
    return "antar";
  }
  if (
    normalized === "/dashboard/keuangan" ||
    normalized.startsWith("/dashboard/keuangan/")
  ) {
    return "keuangan";
  }
  if (
    normalized === "/dashboard/transaksi" ||
    normalized.startsWith("/dashboard/transaksi/")
  ) {
    return "transaksi";
  }
  if (
    normalized === "/dashboard/produk" ||
    normalized.startsWith("/dashboard/produk/") ||
    normalized === "/dashboard/kategori" ||
    normalized.startsWith("/dashboard/kategori/") ||
    normalized === "/dashboard/meja" ||
    normalized.startsWith("/dashboard/meja/") ||
    normalized === "/dashboard/landing-page" ||
    normalized.startsWith("/dashboard/landing-page/")
  ) {
    return "menu_kedai";
  }
  if (
    normalized === "/dashboard/inventory" ||
    normalized.startsWith("/dashboard/inventory/") ||
    normalized === "/dashboard/transfer-stok" ||
    normalized.startsWith("/dashboard/transfer-stok/")
  ) {
    return "inventory";
  }
  if (
    normalized === "/dashboard/opname" ||
    normalized.startsWith("/dashboard/opname/") ||
    normalized === "/dashboard/waste" ||
    normalized.startsWith("/dashboard/waste/")
  ) {
    return "opname_waste";
  }
  if (
    normalized === "/dashboard/supplier" ||
    normalized.startsWith("/dashboard/supplier/")
  ) {
    return "supplier_po";
  }
  if (
    normalized === "/dashboard/cabang" ||
    normalized.startsWith("/dashboard/cabang/") ||
    normalized === "/dashboard/pengaturan" ||
    normalized.startsWith("/dashboard/pengaturan/") ||
    normalized === "/dashboard/pengaturan-utama" ||
    normalized.startsWith("/dashboard/pengaturan-utama/")
  ) {
    return "pengaturan";
  }
  if (
    normalized === "/dashboard/staf" ||
    normalized.startsWith("/dashboard/staf/") ||
    normalized === "/dashboard/audit" ||
    normalized.startsWith("/dashboard/audit/")
  ) {
    return "staf_audit";
  }
  if (normalized === "/dashboard" || normalized.startsWith("/dashboard/")) {
    return "dashboard";
  }

  return null;
}

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
  if (
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  ) {
    return true;
  }
  if (pathname.startsWith("/auth/")) {
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
    normalized === "/dashboard/pengaturan-utama" ||
    normalized.startsWith("/dashboard/pengaturan-utama/") ||
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
  pathname: string,
  customPermissions?: UserCustomPermissions | null
): boolean {
  if (isPublicPathname(pathname)) {
    return true;
  }

  if (role === "owner") {
    return true;
  }

  const requiredPermission = getRequiredPermissionForPathname(pathname);
  if (!requiredPermission) {
    return true;
  }

  return hasUserPermission(role, customPermissions, requiredPermission);
}

export function getDefaultRouteForUser(
  role: UserRole,
  customPermissions?: UserCustomPermissions | null
): string {
  const roleDefault = ROLE_DEFAULT_ROUTE[role];
  if (canRoleAccessPathname(role, roleDefault, customPermissions)) {
    return roleDefault;
  }
  const candidates = [
    "/kasir",
    "/order-manual",
    "/dapur",
    "/antar",
    "/dashboard/inventory",
    "/dashboard/opname",
    "/dashboard/supplier",
    "/dashboard",
    "/dashboard/keuangan",
    "/dashboard/transaksi",
    "/dashboard/produk",
  ];
  return (
    candidates.find((route) =>
      canRoleAccessPathname(role, route, customPermissions)
    ) ?? roleDefault
  );
}

export function getNavItemsForRole(
  role: UserRole
): ReadonlyArray<StaffNavItem> {
  return STAFF_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
}

