import { describe, it } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { computeCrc32, createZipUint8Array } from "../zip.ts";
import { createZipBuffer } from "../zip-server.ts";

describe("src/lib/zip.ts", () => {
  it("menghasilkan checksum CRC-32 IEEE 802.3 standar untuk byte data", () => {
    const sample = new TextEncoder().encode("123456789");
    assert.equal(computeCrc32(sample), 0xcbf43926);
  });

  it("membentuk arsip PKZIP valid berisi beberapa file terpisah dengan struktur header lengkap", () => {
    const enc = new TextEncoder();
    const files = [
      { name: "qr-meja-01.png", data: enc.encode("PNGDATA-01") },
      { name: "qr-meja-02.png", data: enc.encode("PNGDATA-02") },
      { name: "qr-meja-03.png", data: enc.encode("PNGDATA-03") },
    ];

    const zipBytes = createZipUint8Array(files);
    const view = new DataView(
      zipBytes.buffer,
      zipBytes.byteOffset,
      zipBytes.byteLength
    );

    // Pastikan dimulai dengan Local File Header signature 0x04034b50
    assert.equal(view.getUint32(0, true), 0x04034b50);

    // Pastikan End of Central Directory signature 0x06054b50 di 22 byte terakhir
    const eocdOffset = zipBytes.length - 22;
    assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
    assert.equal(view.getUint16(eocdOffset + 8, true), 3);
    assert.equal(view.getUint16(eocdOffset + 10, true), 3);

    const cdOffset = view.getUint32(eocdOffset + 16, true);
    assert.equal(view.getUint32(cdOffset, true), 0x02014b50);

    // Verifikasi CRC-32 file pertama di Local File Header (offset + 14)
    assert.equal(view.getUint32(14, true), computeCrc32(files[0]!.data));
  });
});

describe("src/lib/zip-server.ts", () => {
  it("membuat arsip ZIP DEFLATE valid yang dapat didekompresi kembali", () => {
    const zip = createZipBuffer([
      { name: "ringkasan.csv", content: "Outlet,Total\nLATTE SPACE,150000\n" },
      { name: "latte-space/jurnal.csv", content: "No,Nominal\nJV-01,150000\n" },
    ]);

    // Signature PK\x03\x04 di awal file
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    // End of Central Directory signature di 22 byte terakhir
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
    // Jumlah entry = 2
    assert.equal(zip.readUInt16LE(zip.length - 12), 2);

    // Verifikasi konten entry pertama dapat di-inflate kembali
    const nameLen = zip.readUInt16LE(26);
    const compSize = zip.readUInt32LE(18);
    const dataStart = 30 + nameLen;
    const inflated = zlib
      .inflateRawSync(zip.subarray(dataStart, dataStart + compSize))
      .toString("utf8");
    assert.equal(inflated, "Outlet,Total\nLATTE SPACE,150000\n");
  });
});
