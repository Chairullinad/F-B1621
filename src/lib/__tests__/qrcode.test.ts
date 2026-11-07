import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateQrMatrix, generateQrSvgString } from "../qrcode.ts";

describe("src/lib/qrcode.ts", () => {
  it("menghasilkan matriks QR dan SVG valid untuk URL meja (/m/<token>)", () => {
    const url =
      "https://pos1621.id/m/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";
    const matrix = generateQrMatrix(url);
    assert.ok(matrix.length >= 29);

    const svg = generateQrSvgString(url);
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("<path"));
  });

  it("menghasilkan matriks QR valid untuk payload QRIS EMVCo panjang (~220 karakter)", () => {
    const qris =
      "00020101021226650014ID.CO.QRIS.WWW01189360050300000898240214123456789012340303UMI5204581253033605405620005802ID5919KAFE NUSANTARA 16216007JAKARTA61051011062240516MEJA-07-07-00010707MEJA-0763041A2B";
    const matrix = generateQrMatrix(qris);
    assert.ok(matrix.length >= 53);
  });
});
