/**
 * src/lib/zip.ts
 * Pembungkus arsip ZIP murni dalam TypeScript (PKZIP STORED / method 0 dengan CRC-32)
 * tanpa dependensi eksternal. Ideal untuk file PNG yang sudah terkompresi.
 */

export interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const idx = (crc ^ (bytes[i] ?? 0)) & 0xff;
    crc = (CRC32_TABLE[idx] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Menggabungkan daftar file menjadi byte array berformat `.zip` standar PKZIP.
 */
export function createZipUint8Array(
  entries: ReadonlyArray<ZipEntryInput>
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();

  interface PreparedEntry {
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    localHeaderOffset: number;
  }

  const prepared: PreparedEntry[] = [];
  let offset = 0;
  let centralDirSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = computeCrc32(entry.data);
    prepared.push({
      nameBytes,
      data: entry.data,
      crc,
      localHeaderOffset: offset,
    });
    offset += 30 + nameBytes.length + entry.data.length;
    centralDirSize += 46 + nameBytes.length;
  }

  const totalSize = offset + centralDirSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const out = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // MS-DOS timestamp tetap valid (2026-11-25 11:00)
  const dosTime = 0x5800;
  const dosDate = 0x5d79;

  // 1. Tulis Local File Headers + isi file
  let cursor = 0;
  for (const item of prepared) {
    view.setUint32(cursor, 0x04034b50, true); // Local file header signature
    view.setUint16(cursor + 4, 20, true); // Version needed
    view.setUint16(cursor + 6, 0x0800, true); // UTF-8 filename flag
    view.setUint16(cursor + 8, 0, true); // Method 0 = STORED
    view.setUint16(cursor + 10, dosTime, true);
    view.setUint16(cursor + 12, dosDate, true);
    view.setUint32(cursor + 14, item.crc, true);
    view.setUint32(cursor + 18, item.data.length, true);
    view.setUint32(cursor + 22, item.data.length, true);
    view.setUint16(cursor + 26, item.nameBytes.length, true);
    view.setUint16(cursor + 28, 0, true); // Extra length

    out.set(item.nameBytes, cursor + 30);
    out.set(item.data, cursor + 30 + item.nameBytes.length);
    cursor += 30 + item.nameBytes.length + item.data.length;
  }

  // 2. Tulis Central Directory Headers
  const centralDirStart = cursor;
  for (const item of prepared) {
    view.setUint32(cursor, 0x02014b50, true); // Central directory signature
    view.setUint16(cursor + 4, 20, true); // Version made by
    view.setUint16(cursor + 6, 20, true); // Version needed
    view.setUint16(cursor + 8, 0x0800, true); // UTF-8 filename flag
    view.setUint16(cursor + 10, 0, true); // Method 0 = STORED
    view.setUint16(cursor + 12, dosTime, true);
    view.setUint16(cursor + 14, dosDate, true);
    view.setUint32(cursor + 16, item.crc, true);
    view.setUint32(cursor + 20, item.data.length, true);
    view.setUint32(cursor + 24, item.data.length, true);
    view.setUint16(cursor + 28, item.nameBytes.length, true);
    view.setUint16(cursor + 30, 0, true); // Extra length
    view.setUint16(cursor + 32, 0, true); // Comment length
    view.setUint16(cursor + 34, 0, true); // Disk number start
    view.setUint16(cursor + 36, 0, true); // Internal attributes
    view.setUint32(cursor + 38, 0, true); // External attributes
    view.setUint32(cursor + 42, item.localHeaderOffset, true);

    out.set(item.nameBytes, cursor + 46);
    cursor += 46 + item.nameBytes.length;
  }

  // 3. Tulis End of Central Directory (EOCD)
  view.setUint32(cursor, 0x06054b50, true);
  view.setUint16(cursor + 4, 0, true);
  view.setUint16(cursor + 6, 0, true);
  view.setUint16(cursor + 8, prepared.length, true);
  view.setUint16(cursor + 10, prepared.length, true);
  view.setUint32(cursor + 12, centralDirSize, true);
  view.setUint32(cursor + 16, centralDirStart, true);
  view.setUint16(cursor + 20, 0, true);

  return out;
}

export function createZipBlob(entries: ReadonlyArray<ZipEntryInput>): Blob {
  const bytes = createZipUint8Array(entries);
  return new Blob([bytes.buffer], { type: "application/zip" });
}
