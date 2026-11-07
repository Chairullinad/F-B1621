import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeQrisCrc16,
  generateDynamicQrisPayload,
  parseEmvTags,
} from "../qris.ts";

const SAMPLE_STATIC_QRIS =
  "00020101021126650014ID.CO.QRIS.WWW01189360050300000898240214123456789012340303UMI5204581253033605802ID5919KAFE NUSANTARA 16216007JAKARTA6105101106304A1B2";

describe("src/lib/qris.ts", () => {
  it("mengubah QRIS statis menjadi QRIS bernominal murni dengan label MEJA dan CRC16 valid", () => {
    const result = generateDynamicQrisPayload({
      staticQrisPayload: SAMPLE_STATIC_QRIS,
      amountRupiah: 62000,
      tableNo: 7,
      orderNo: "20261107-0001",
    });

    const tags = parseEmvTags(result);
    const tag01 = tags.find((t) => t.id === "01");
    const tag54 = tags.find((t) => t.id === "54");
    const tag62 = tags.find((t) => t.id === "62");
    const tag63 = tags.find((t) => t.id === "63");

    assert.equal(tag01?.value, "12");
    assert.equal(tag54?.value, "62000"); // Murni nominal pesanan, tanpa tambahan angka
    assert.ok(tag62?.value.includes("MEJA-07"));
    assert.ok(tag63?.value);

    const withoutCrc = result.slice(0, -4);
    assert.equal(computeQrisCrc16(withoutCrc), tag63?.value);
  });

  it("menolak nominal 0 atau negatif", () => {
    assert.throws(() =>
      generateDynamicQrisPayload({
        staticQrisPayload: SAMPLE_STATIC_QRIS,
        amountRupiah: 0,
      })
    );
  });
});
