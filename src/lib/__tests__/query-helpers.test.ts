import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchAllPaginated, isUniqueOrderNoViolation } from "../query-helpers.ts";

describe("src/lib/query-helpers.ts", () => {
  it("mengambil seluruh data lintas beberapa halaman melewati batas 1000 baris", async () => {
    const totalRows = 25;
    const dataset = Array.from({ length: totalRows }, (_, i) => ({
      id: `order-${i + 1}`,
      total: (i + 1) * 1000,
    }));

    const calls: Array<{ from: number; to: number }> = [];
    const rows = await fetchAllPaginated(
      async (from, to) => {
        calls.push({ from, to });
        return {
          data: dataset.slice(from, to + 1),
          error: null,
        };
      },
      10,
      10
    );

    assert.equal(rows.length, totalRows);
    assert.deepEqual(calls, [
      { from: 0, to: 9 },
      { from: 10, to: 19 },
      { from: 20, to: 29 },
    ]);
    assert.equal(rows[0]?.id, "order-1");
    assert.equal(rows[24]?.id, "order-25");
  });

  it("berhenti tepat di maxPages atau melempar error ketika halaman gagal", async () => {
    let fetchCount = 0;
    const capped = await fetchAllPaginated(
      async (from, to) => {
        fetchCount += 1;
        return {
          data: Array.from({ length: to - from + 1 }, (_, i) => from + i),
          error: null,
        };
      },
      5,
      2
    );
    assert.equal(fetchCount, 2);
    assert.equal(capped.length, 10);

    await assert.rejects(
      () =>
        fetchAllPaginated(async () => ({
          data: null,
          error: { message: "Koneksi database terputus" },
        })),
      /Koneksi database terputus/
    );
  });

  it("mendeteksi unique violation 23505 untuk order_no dan mengabaikan error lain", () => {
    assert.equal(
      isUniqueOrderNoViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "orders_outlet_order_no_key"',
      }),
      true
    );
    assert.equal(
      isUniqueOrderNoViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "orders_idempotency_key_key"',
      }),
      false
    );
    assert.equal(
      isUniqueOrderNoViolation({
        code: "23503",
        message: "foreign key violation",
      }),
      false
    );
    assert.equal(isUniqueOrderNoViolation(null), false);
  });
});
