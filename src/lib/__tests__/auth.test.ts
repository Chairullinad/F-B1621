import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canRoleAccessPathname,
  getDefaultRouteForRole,
  isPublicPathname,
} from "../auth.ts";

describe("src/lib/auth.ts", () => {
  it("mengembalikan rute default yang tepat untuk setiap role", () => {
    assert.equal(getDefaultRouteForRole("owner"), "/dashboard");
    assert.equal(getDefaultRouteForRole("cashier"), "/kasir");
    assert.equal(getDefaultRouteForRole("warehouse"), "/dashboard/inventory");
    assert.equal(getDefaultRouteForRole("kitchen"), "/dapur");
    assert.equal(getDefaultRouteForRole("waiter"), "/antar");
  });

  it("mengizinkan rute publik (/m/[token] dan /login) tanpa login", () => {
    assert.equal(isPublicPathname("/m/abc123token"), true);
    assert.equal(isPublicPathname("/login"), true);
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

    // Dapur hanya bisa mengakses /dapur
    assert.equal(canRoleAccessPathname("kitchen", "/dapur"), true);
    assert.equal(canRoleAccessPathname("kitchen", "/kasir"), false);
    assert.equal(canRoleAccessPathname("kitchen", "/dashboard"), false);
    assert.equal(canRoleAccessPathname("kitchen", "/antar"), false);

    // Pelayan hanya bisa mengakses /antar
    assert.equal(canRoleAccessPathname("waiter", "/antar"), true);
    assert.equal(canRoleAccessPathname("waiter", "/kasir"), false);
    assert.equal(canRoleAccessPathname("waiter", "/dapur"), false);
    assert.equal(canRoleAccessPathname("waiter", "/dashboard"), false);
  });
});

