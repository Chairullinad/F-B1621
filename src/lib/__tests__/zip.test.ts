import { describe, it } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { createZipBuffer } from "../zip.ts";

describe("src/lib/zip.ts", () => {
  it("membuat arsip ZIP valid yang dapat didekompresi kembali", () => {
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
