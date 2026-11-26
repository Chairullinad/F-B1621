export interface ShiftCashAdjustmentItem {
  id: string;
  itemName: string;
  qtyLabel: string;
  amount: number;
}

export interface ShiftCashSummaryInput {
  openingCash: number;
  cashRevenue: number;
  cashRefundTotal: number;
  incomes: ReadonlyArray<Pick<ShiftCashAdjustmentItem, "amount">>;
  expenses: ReadonlyArray<Pick<ShiftCashAdjustmentItem, "amount">>;
  actualClosingCash?: number | null;
}

export interface ShiftCashSummaryResult {
  totalIncomes: number;
  totalExpenses: number;
  expectedClosingCash: number;
  actualClosingCash: number;
  cashDifference: number;
}

/**
 * Menghitung total pemasukan kas tambahan, total pengeluaran kas,
 * ekspektasi kas akhir di laci, dan selisih kas aktual shift.
 */
export function calculateShiftCashSummary(
  input: ShiftCashSummaryInput
): ShiftCashSummaryResult {
  const totalIncomes = input.incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = input.expenses.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const expectedClosingCash =
    input.openingCash +
    input.cashRevenue +
    totalIncomes -
    input.cashRefundTotal -
    totalExpenses;

  const actualClosingCash =
    typeof input.actualClosingCash === "number" &&
    Number.isFinite(input.actualClosingCash)
      ? Math.round(input.actualClosingCash)
      : expectedClosingCash;

  const cashDifference = actualClosingCash - expectedClosingCash;

  return {
    totalIncomes,
    totalExpenses,
    expectedClosingCash,
    actualClosingCash,
    cashDifference,
  };
}
