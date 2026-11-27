import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildArchivedStaffEmail,
  canOwnerAccessWithoutOutlet,
  canRoleAccessPathname,
  getDefaultRouteForRole,
  hasUserPermission,
  isPublicPathname,
  validateStaffDeletion,
} from "../auth.ts";

describe("src/lib/auth.ts", () => {
  it("mengembalikan rute default yang tepat untuk setiap role", () => {
    assert.equal(getDefaultRouteForRole("owner"), "/dashboard");
    assert.equal(getDefaultRouteForRole("cashier"), "/kasir");
    assert.equal(getDefaultRouteForRole("warehouse"), "/dashboard/inventory");
    assert.equal(getDefaultRouteForRole("kitchen"), "/dapur");
    assert.equal(getDefaultRouteForRole("waiter"), "/antar");
  });

  it("mengizinkan rute publik (/m/[token], /login, /reset-password) tanpa login", () => {
    assert.equal(isPublicPathname("/m/abc123token"), true);
    assert.equal(isPublicPathname("/login"), true);
    assert.equal(isPublicPathname("/reset-password"), true);
    assert.equal(isPublicPathname("/auth/callback"), true);
    assert.equal(isPublicPathname("/kasir"), false);
  });

  it("membatasi akses rute berdasarkan role sesuai Bagian 3 PRD", () => {
    // Owner bisa mengakses semua layar
    assert.equal(canRoleAccessPathname("owner", "/dashboard"), true);
    assert.equal(canRoleAccessPathname("owner", "/dashboard/produk"), true);
    assert.equal(canRoleAccessPathname("owner", "/kasir"), true);
    assert.equal(canRoleAccessPathname("owner", "/order-manual"), true);
    assert.equal(canRoleAccessPathname("owner", "/dapur"), true);
    assert.equal(canRoleAccessPathname("owner", "/antar"), true);

    // Kasir hanya bisa mengakses /kasir, /order-manual, dan /struk/*
    assert.equal(canRoleAccessPathname("cashier", "/kasir"), true);
    assert.equal(canRoleAccessPathname("cashier", "/order-manual"), true);
    assert.equal(canRoleAccessPathname("cashier", "/struk/ord-1"), true);
    assert.equal(canRoleAccessPathname("cashier", "/dashboard"), false);
    assert.equal(canRoleAccessPathname("cashier", "/dapur"), false);
    assert.equal(canRoleAccessPathname("cashier", "/antar"), false);

    // Staff Gudang hanya bisa mengakses inventory, opname, waste, supplier, dan transfer
    assert.equal(canRoleAccessPathname("warehouse", "/dashboard/inventory"), true);
    assert.equal(canRoleAccessPathname("warehouse", "/dashboard/opname"), true);
    assert.equal(canRoleAccessPathname("warehouse", "/dashboard/waste"), true);
    assert.equal(canRoleAccessPathname("warehouse", "/dashboard/supplier"), true);
    assert.equal(canRoleAccessPathname("warehouse", "/dashboard/transfer-stok"), true);
    assert.equal(canRoleAccessPathname("warehouse", "/dashboard"), false);
    assert.equal(canRoleAccessPathname("warehouse", "/kasir"), false);
    assert.equal(canRoleAccessPathname("warehouse", "/dapur"), false);
    assert.equal(canRoleAccessPathname("warehouse", "/antar"), false);

    // Dapur hanya bisa mengakses /dapur dan cetak tiket /dapur/struk/*
    assert.equal(canRoleAccessPathname("kitchen", "/dapur"), true);
    assert.equal(canRoleAccessPathname("kitchen", "/dapur/struk/ord-1"), true);
    assert.equal(canRoleAccessPathname("kitchen", "/kasir"), false);
    assert.equal(canRoleAccessPathname("kitchen", "/struk/ord-1"), false);
    assert.equal(canRoleAccessPathname("kitchen", "/dashboard"), false);
    assert.equal(canRoleAccessPathname("kitchen", "/antar"), false);

    // Pelayan hanya bisa mengakses /antar
    assert.equal(canRoleAccessPathname("waiter", "/antar"), true);
    assert.equal(canRoleAccessPathname("waiter", "/kasir"), false);
    assert.equal(canRoleAccessPathname("waiter", "/dapur"), false);
    assert.equal(canRoleAccessPathname("waiter", "/dashboard"), false);
  });

  it("membatasi owner tanpa outlet aktif (Holding Mode) ke Beranda, Laporan, Setting Outlet, dan Akses & Keamanan", () => {
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/keuangan"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/keuangan/detail"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/transaksi"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/cabang"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/cabang/edit"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/pengaturan-utama"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/staf"), true);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/audit"), true);

    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/produk"), false);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/inventory"), false);
    assert.equal(canOwnerAccessWithoutOutlet("/dashboard/pengaturan"), false);
    assert.equal(canOwnerAccessWithoutOutlet("/kasir"), false);
    assert.equal(canOwnerAccessWithoutOutlet("/dapur"), false);
    assert.equal(canOwnerAccessWithoutOutlet("/antar"), false);
  });

  it("mendukung custom per-user permissions ketika staf dipromosikan", () => {
    // Kasir promosi diberi akses laporan transaksi dan stock opname
    const promotedCashier = {
      transaksi: true,
      opname_waste: true,
      order_manual: false,
    };
    assert.equal(
      canRoleAccessPathname("cashier", "/dashboard/transaksi", promotedCashier),
      true
    );
    assert.equal(
      canRoleAccessPathname("cashier", "/dashboard/opname", promotedCashier),
      true
    );
    assert.equal(
      canRoleAccessPathname("cashier", "/order-manual", promotedCashier),
      false
    );
    assert.equal(
      canRoleAccessPathname("cashier", "/kasir", promotedCashier),
      true
    );

    // Kasir baru (default) punya izin kasir namun TIDAK punya izin dapur/antar kecuali dipromosikan
    assert.equal(hasUserPermission("cashier", null, "kasir"), true);
    assert.equal(hasUserPermission("cashier", null, "dapur"), false);
    assert.equal(hasUserPermission("cashier", null, "antar"), false);
    assert.equal(
      hasUserPermission("cashier", { dapur: true, antar: true }, "dapur"),
      true
    );
  });

  it("menolak hapus akun sendiri atau satu-satunya Owner aktif, dan mengizinkan hapus staf tidak terpakai", () => {
    const selfRes = validateStaffDeletion({
      targetUserId: "owner-1",
      currentOwnerId: "owner-1",
      targetRole: "owner",
      targetIsActive: true,
      activeOwnerCount: 2,
    });
    assert.equal(selfRes.ok, false);

    const lastOwnerRes = validateStaffDeletion({
      targetUserId: "owner-2",
      currentOwnerId: "owner-1",
      targetRole: "owner",
      targetIsActive: true,
      activeOwnerCount: 1,
    });
    assert.equal(lastOwnerRes.ok, false);

    const validCashierRes = validateStaffDeletion({
      targetUserId: "cashier-1",
      currentOwnerId: "owner-1",
      targetRole: "cashier",
      targetIsActive: true,
      activeOwnerCount: 1,
    });
    assert.equal(validCashierRes.ok, true);

    assert.equal(
      buildArchivedStaffEmail("a1b2c3d4-9999", 1700000000000),
      "deleted-a1b2c3d4-1700000000000@archived.fnb1621.local"
    );
  });
});

