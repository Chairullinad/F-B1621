import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCashChange,
  calculateLineTotal,
  calculateOrderTotals,
  formatRupiah,
  roundRupiah,
} from "../money.ts";

describe("src/lib/money.ts", () => {
  it("memformat integer Rupiah sesuai konvensi 'Rp 25.000'", () => {
    assert.equal(formatRupiah(0), "Rp 0");
    assert.equal(formatRupiah(25000), "Rp 25.000");
    assert.equal(formatRupiah(1250500), "Rp 1.250.500");
    assert.equal(formatRupiah(-15000), "-Rp 15.000");
  });

  it("membulatkan nilai ke bilangan bulat Rupiah terdekat", () => {
    assert.equal(roundRupiah(1234.4), 1234);
    assert.equal(roundRupiah(1234.5), 1235);
  });

  it("menghitung line_total dengan benar dan menolak harga float atau qty <= 0", () => {
    assert.equal(calculateLineTotal(25000, 3), 75000);
    assert.throws(() => calculateLineTotal(25000.5, 1));
    assert.throws(() => calculateLineTotal(25000, 0));
  });

  it("menghitung total saat pajak dan service charge mati (default)", () => {
    const result = calculateOrderTotals({
      items: [
        { unitPrice: 35000, qty: 2 },
        { unitPrice: 22000, qty: 1 },
      ],
      config: {
        taxEnabled: false,
        taxPercent: null,
        serviceEnabled: false,
        servicePercent: null,
        priceIncludesTax: false,
      },
    });

    assert.equal(result.subtotal, 92000);
    assert.equal(result.discount, 0);
    assert.equal(result.serviceAmount, 0);
    assert.equal(result.taxAmount, 0);
    assert.equal(result.total, 92000);
  });

  it("menolak saklar pajak/service menyala jika persentase kosong", () => {
    assert.throws(
      () =>
        calculateOrderTotals({
          items: [{ unitPrice: 25000, qty: 1 }],
          config: {
            taxEnabled: true,
            taxPercent: null,
            serviceEnabled: false,
            servicePercent: null,
            priceIncludesTax: false,
          },
        }),
      /persentase pajak/
    );
  });

  it("menghitung mode belum termasuk pajak: service = %*(subtotal-diskon), pajak = %*(subtotal-diskon+service)", () => {
    const result = calculateOrderTotals({
      items: [{ unitPrice: 100000, qty: 1 }],
      discount: { type: "amount", value: 10000 }, // afterDiscount = 90.000
      config: {
        taxEnabled: true,
        taxPercent: 10,
        serviceEnabled: true,
        servicePercent: 5,
        priceIncludesTax: false,
      },
    });

    // service = 5% * 90.000 = 4.500
    // pajak   = 10% * (90.000 + 4.500) = 9.450
    // total   = 90.000 + 4.500 + 9.450 = 103.950
    assert.equal(result.subtotal, 100000);
    assert.equal(result.discount, 10000);
    assert.equal(result.serviceAmount, 4500);
    assert.equal(result.taxAmount, 9450);
    assert.equal(result.total, 103950);
  });

  it("menghitung mode sudah termasuk pajak: total tidak ditambah pajak, pajak dihitung sebagai komponen", () => {
    const result = calculateOrderTotals({
      items: [{ unitPrice: 110000, qty: 1 }],
      config: {
        taxEnabled: true,
        taxPercent: 10,
        serviceEnabled: false,
        servicePercent: null,
        priceIncludesTax: true,
      },
    });

    assert.equal(result.total, 110000);
    assert.equal(result.taxAmount, 10000);
  });

  it("menghitung kembalian tunai dan menolak bila uang diterima kurang dari total", () => {
    assert.equal(calculateCashChange(75000, 100000), 25000);
    assert.equal(calculateCashChange(75000, 75000), 0);
    assert.throws(() => calculateCashChange(75000, 50000), /tidak boleh kurang/);
  });
});
