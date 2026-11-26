import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBluetoothTestPrintEscPosBytes,
  buildOrderReceiptEscPosBytes,
  buildOrderReceiptTextLines,
  encodeEscPosBytesToBase64,
  formatEscPosColumns,
  getEscPosColumnWidth,
  sanitizeEscPosText,
} from "../escpos.ts";
import type { OrderReceiptDetail } from "../../server/cashier.ts";

const SAMPLE_RECEIPT: OrderReceiptDetail = {
  orderId: "00000000-0000-0000-0000-000000000001",
  orderNo: "20261126-0008",
  outletName: "Kopi 1621 — Cabang Utama",
  outletAddress: "Jl. Jend. Sudirman No. 16, Jakarta",
  receiptFooter: "Terima kasih • Follow @1621group!",
  orderType: "dine_in",
  tableName: "Meja 12",
  status: "paid",
  cashierName: "Budi Kasir",
  paymentMethod: "cash",
  subtotal: 65000,
  discount: 5000,
  discountReason: "Promo Member",
  serviceRate: 5,
  serviceAmount: 3000,
  taxRate: 10,
  taxAmount: 6300,
  priceIncludesTax: false,
  total: 69300,
  amountReceived: 100000,
  changeAmount: 30700,
  createdAt: "2026-11-26T02:15:00.000Z",
  paidAt: "2026-11-26T02:16:00.000Z",
  cancelledAt: null,
  cancelReason: null,
  refund: null,
  items: [
    {
      id: "item-1",
      productId: "prod-1",
      productName: "Es Kopi Susu Gula Aren Signature Jumbo",
      unitPrice: 25000,
      qty: 2,
      note: "Less sugar, extra shot",
      lineTotal: 50000,
    },
    {
      id: "item-2",
      productId: "prod-2",
      productName: "Croissant Butter",
      unitPrice: 15000,
      qty: 1,
      note: null,
      lineTotal: 15000,
    },
  ],
};

describe("src/lib/escpos.ts", () => {
  it("menetapkan lebar kolom standar thermal 32 karakter (58mm) dan 48 karakter (80mm)", () => {
    assert.equal(getEscPosColumnWidth("58mm"), 32);
    assert.equal(getEscPosColumnWidth("80mm"), 48);
  });

  it("membersihkan karakter non-ASCII dan menyusun kolom kanan-kiri sesuai lebar kertas", () => {
    assert.equal(sanitizeEscPosText("Kopi • Café — “Mantap”"), 'Kopi - Cafe - "Mantap"');

    const cols58 = formatEscPosColumns("TOTAL", "Rp 69.300", 32);
    assert.equal(cols58.length, 1);
    assert.equal(cols58[0]?.length, 32);
    assert.ok(cols58[0]?.startsWith("TOTAL"));
    assert.ok(cols58[0]?.endsWith("Rp 69.300"));
  });

  it("membentuk baris struk 58mm dan tiket kitchen tanpa melebihi batas 32 karakter", () => {
    const lines = buildOrderReceiptTextLines(SAMPLE_RECEIPT, {
      paperSize: "58mm",
      mode: "both",
    });

    for (const line of lines) {
      assert.ok(
        line.length <= 32,
        `Baris melebihi 32 karakter (${line.length}): "${line}"`
      );
    }

    const joined = lines.join("\n");
    assert.ok(joined.includes("#20261126-0008"));
    assert.ok(joined.includes("Meja 12"));
    assert.ok(joined.includes("Rp 69.300"));
    assert.ok(joined.includes("Rp 30.700"));
    assert.ok(joined.includes("TIKET ANTREAN KITCHEN"));
    assert.ok(joined.includes("[ ] 2x Es Kopi Susu Gula Aren"));
    assert.ok(joined.includes("CATATAN: Less sugar, extra shot"));
  });

  it("membentuk byte ESC/POS dengan header ESC @ dan perintah potong/feed serta base64 valid untuk RawBT", () => {
    const bytes = buildOrderReceiptEscPosBytes(SAMPLE_RECEIPT, {
      paperSize: "80mm",
      mode: "customer",
    });

    assert.equal(bytes[0], 0x1b);
    assert.equal(bytes[1], 0x40);
    assert.equal(bytes[bytes.length - 4], 0x1d);
    assert.equal(bytes[bytes.length - 3], 0x56);
    assert.equal(bytes[bytes.length - 2], 0x42);
    assert.equal(bytes[bytes.length - 1], 0x00);

    const decoded = Buffer.from(bytes).toString("ascii");
    assert.ok(decoded.includes("KOPI 1621 - CABANG UTAMA"));
    assert.ok(decoded.includes("Rp 69.300"));
    assert.ok(!decoded.includes("TIKET ANTREAN KITCHEN"));

    const testBytes = buildBluetoothTestPrintEscPosBytes("58mm", "RPP02N");
    const base64 = encodeEscPosBytesToBase64(testBytes);
    assert.deepEqual(new Uint8Array(Buffer.from(base64, "base64")), testBytes);
  });
});
