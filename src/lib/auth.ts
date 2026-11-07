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
  kitchen: "Dapur",
  waiter: "Pelayan",
};

export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  owner: "/dashboard",
  cashier: "/kasir",
  kitchen: "/dapur",
  waiter: "/antar",
};

export interface StaffNavItem {
  href: string;
  label: string;
  allowedRoles: ReadonlyArray<UserRole>;
}

export const STAFF_NAV_ITEMS: ReadonlyArray<StaffNavItem> = [
  {
    href: "/kasir",
    label: "Layar Kasir",
    allowedRoles: ["owner", "cashier"],
  },
  {
    href: "/order-manual",
    label: "Order Manual",
    allowedRoles: ["owner", "cashier"],
  },
  {
    href: "/dapur",
    label: "Layar Dapur",
    allowedRoles: ["owner", "kitchen"],
  },
  {
    href: "/antar",
    label: "Layar Antar",
    allowedRoles: ["owner", "waiter"],
  },
  {
    href: "/dashboard",
    label: "Dashboard Owner",
    allowedRoles: ["owner"],
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
