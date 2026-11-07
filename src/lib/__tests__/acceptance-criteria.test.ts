import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canRoleAccessPathname } from "../auth.ts";
import {
  calculateOrderTotals,
  formatRupiah,
  validateTaxAndServiceConfig,
} from "../money.ts";
import { generateDynamicQrisPayload } from "../qris.ts";

const SAMPLE_STATIC_QRIS =
  "00020101021126610014COM.GO-JEK.WWW01189360091430016210010210G0016210010303UMI51440014ID.CO.QRIS.WWW0215ID10240016210010303UMI5204581253033605802ID5919KAFE NUSANTARA 16216013JAKARTA PUSAT61051011062070703A0163044E2A";

describe("PRD Bagian 12 — Kriteria Penerimaan MVP (Aturan Uang, QRIS Meja, Pajak Snapshot, & RBAC)", () => {
  it("Kriteria 1 & 15: QRIS Meja memuat nominal murni sesuai tagihan dan label MEJA-<no> tanpa tambahan kode unik", () => {
    const orderTotal = 73500;
    const payload = generateDynamicQrisPayload({
      staticQrisPayload: SAMPLE_STATIC_QRIS,
      amountRupiah: orderTotal,
      tableNo: 18,
    });

    // Tag 54 = panjang '73500' (05) diikuti '73500' (nominal murni, bukan 73518)
    assert.ok(payload.includes("540573500"));
    // Tag 62 sub-tag 05 = MEJA-18
    assert.ok(payload.includes("MEJA-18"));
  });

  it("Kriteria 7: Pelayan dan Dapur tidak memiliki akses ke kasir, order manual, atau dashboard pengaturan", () => {
    assert.equal(canRoleAccessPathname("waiter", "/kasir"), false);
    assert.equal(canRoleAccessPathname("waiter", "/order-manual"), false);
    assert.equal(canRoleAccessPathname("waiter", "/dashboard"), false);
    assert.equal(canRoleAccessPathname("waiter", "/antar"), true);

    assert.equal(canRoleAccessPathname("kitchen", "/kasir"), false);
    assert.equal(canRoleAccessPathname("kitchen", "/dapur"), true);
  });

  it("Kriteria 8: Pajak dan service charge mati secara default dan tidak bisa dinyalakan sebelum persentase diisi", () => {
    assert.throws(() => {
      validateTaxAndServiceConfig({
        taxEnabled: true,
        taxPercent: null,
        serviceEnabled: false,
        servicePercent: null,
        priceIncludesTax: false,
      });
    });

    const offTotals = calculateOrderTotals({
      items: [{ unitPrice: 25000, qty: 2 }],
      discount: { type: "none" },
      config: {
        taxEnabled: false,
        taxPercent: null,
        serviceEnabled: false,
        servicePercent: null,
        priceIncludesTax: false,
      },
    });
    assert.equal(offTotals.serviceAmount, 0);
    assert.equal(offTotals.taxAmount, 0);
    assert.equal(offTotals.total, 50000);
    assert.equal(formatRupiah(offTotals.total), "Rp 50.000");
  });

  it("Kriteria 9: Saat pajak dinyalakan, perhitungan konsisten dan order lama mempertahankan snapshot-nya", () => {
    // Order lama dibuat saat pajak mati
    const oldOrderSnapshot = calculateOrderTotals({
      items: [{ unitPrice: 50000, qty: 2 }],
      discount: { type: "amount", value: 10000 },
      config: {
        taxEnabled: false,
        taxPercent: null,
        serviceEnabled: false,
        servicePercent: null,
        priceIncludesTax: false,
      },
    });

    // Owner kemudian menyalakan service 5% + pajak 10% (belum termasuk pajak) untuk order baru
    const newOrderTotals = calculateOrderTotals({
      items: [{ unitPrice: 50000, qty: 2 }],
      discount: { type: "amount", value: 10000 },
      config: {
        taxEnabled: true,
        taxPercent: 10,
        serviceEnabled: true,
        servicePercent: 5,
        priceIncludesTax: false,
      },
    });

    // Order lama tetap Rp 90.000
    assert.equal(oldOrderSnapshot.total, 90000);
    // Order baru: subtotal 100.000 - diskon 10.000 = 90.000; service 5% = 4.500; pajak 10% * 94.500 = 9.450 -> total 103.950
    assert.equal(newOrderTotals.serviceAmount, 4500);
    assert.equal(newOrderTotals.taxAmount, 9450);
    assert.equal(newOrderTotals.total, 103950);
  });
});
