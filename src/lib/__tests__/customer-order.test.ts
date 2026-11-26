import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOutletQrisDisabled,
  resolveCustomerPaymentChoice,
} from "../customer-order.ts";

describe("src/lib/customer-order.ts", () => {
  it("menentukan status aktif/nonaktif QRIS berdasarkan pengaturan outlet dan payload QRIS", () => {
    assert.equal(
      isOutletQrisDisabled({
        qris_enabled: true,
        qris_raw_payload: "000201010211...",
      }),
      false
    );
    assert.equal(
      isOutletQrisDisabled({
        qris_enabled: false,
        qris_raw_payload: "000201010211...",
      }),
      true
    );
    assert.equal(
      isOutletQrisDisabled({
        qris_enabled: true,
        qris_raw_payload: "",
      }),
      true
    );
  });

  it("menolak pembayaran QRIS dan mengizinkan bayar di kasir saat QRIS dinonaktifkan outlet", () => {
    const qrisResult = resolveCustomerPaymentChoice("qris", true);
    assert.equal(qrisResult.ok, false);
    if (!qrisResult.ok) {
      assert.match(qrisResult.message, /dinonaktifkan/i);
      assert.match(qrisResult.message, /Bayar di Kasir/i);
    }

    const cashResult = resolveCustomerPaymentChoice("cash", true);
    assert.deepEqual(cashResult, { ok: true, paymentChoice: "cash" });
  });

  it("mengizinkan kedua metode pembayaran apabila QRIS diaktifkan oleh outlet", () => {
    const qrisResult = resolveCustomerPaymentChoice("qris", false);
    assert.deepEqual(qrisResult, { ok: true, paymentChoice: "qris" });

    const cashResult = resolveCustomerPaymentChoice("cash", false);
    assert.deepEqual(cashResult, { ok: true, paymentChoice: "cash" });
  });
});
