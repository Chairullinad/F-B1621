import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_QRIS_UNDER_MAINTENANCE,
  resolveCustomerPaymentChoice,
} from "../customer-order.ts";

describe("src/lib/customer-order.ts", () => {
  it("mengaktifkan status perbaikan QRIS untuk pesanan pelanggan saat ini", () => {
    assert.equal(CUSTOMER_QRIS_UNDER_MAINTENANCE, true);
  });

  it("menolak pembayaran QRIS dan mengizinkan bayar di kasir saat QRIS sedang dalam perbaikan", () => {
    const qrisResult = resolveCustomerPaymentChoice("qris", true);
    assert.equal(qrisResult.ok, false);
    if (!qrisResult.ok) {
      assert.match(qrisResult.message, /sedang dalam perbaikan/i);
      assert.match(qrisResult.message, /Bayar di Kasir/i);
      assert.doesNotMatch(qrisResult.message, /Tunai/i);
    }

    const cashResult = resolveCustomerPaymentChoice("cash", true);
    assert.deepEqual(cashResult, { ok: true, paymentChoice: "cash" });
  });

  it("mengizinkan kedua metode pembayaran apabila mode perbaikan QRIS dimatikan", () => {
    const qrisResult = resolveCustomerPaymentChoice("qris", false);
    assert.deepEqual(qrisResult, { ok: true, paymentChoice: "qris" });

    const cashResult = resolveCustomerPaymentChoice("cash", false);
    assert.deepEqual(cashResult, { ok: true, paymentChoice: "cash" });
  });
});
