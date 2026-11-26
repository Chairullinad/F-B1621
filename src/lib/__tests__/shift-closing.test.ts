import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateShiftCashSummary } from "../shift-closing.ts";

describe("src/lib/shift-closing.ts", () => {
  it("menghitung kas akhir ekspektasi dengan menambahkan pemasukan kas dan mengurangi refund serta pengeluaran", () => {
    const result = calculateShiftCashSummary({
      openingCash: 200000,
      cashRevenue: 450000,
      cashRefundTotal: 25000,
      incomes: [
        { amount: 100000 },
        { amount: 15000 },
      ],
      expenses: [
        { amount: 30000 },
        { amount: 20000 },
      ],
      actualClosingCash: 690000,
    });

    assert.equal(result.totalIncomes, 115000);
    assert.equal(result.totalExpenses, 50000);
    // 200.000 + 450.000 + 115.000 - 25.000 - 50.000 = 690.000
    assert.equal(result.expectedClosingCash, 690000);
    assert.equal(result.actualClosingCash, 690000);
    assert.equal(result.cashDifference, 0);
  });

  it("menghitung selisih kas kurang dan lebih secara akurat", () => {
    const shortage = calculateShiftCashSummary({
      openingCash: 100000,
      cashRevenue: 50000,
      cashRefundTotal: 0,
      incomes: [{ amount: 25000 }],
      expenses: [],
      actualClosingCash: 165000,
    });

    assert.equal(shortage.expectedClosingCash, 175000);
    assert.equal(shortage.cashDifference, -10000);

    const surplus = calculateShiftCashSummary({
      openingCash: 100000,
      cashRevenue: 50000,
      cashRefundTotal: 0,
      incomes: [{ amount: 25000 }],
      expenses: [{ amount: 5000 }],
      actualClosingCash: 180000,
    });

    assert.equal(surplus.expectedClosingCash, 170000);
    assert.equal(surplus.cashDifference, 10000);
  });
});
