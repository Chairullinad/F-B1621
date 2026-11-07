/**
 * src/lib/qrcode.ts
 * Generator QR Code (ISO/IEC 18004, Byte Mode, Error Correction Level L)
 * murni dalam TypeScript tanpa dependensi eksternal.
 * Mendukung Version 1 s/d Version 12 (hingga 367 byte data), cukup untuk:
 * - URL QR Meja (/m/<48_char_token>)
 * - Payload QRIS Dinamis EMVCo Bank Indonesia (~220-260 karakter)
 */

interface VersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocksGroup1: number;
  dataCodewordsGroup1: number;
  numBlocksGroup2: number;
  dataCodewordsGroup2: number;
  alignmentPatterns: ReadonlyArray<number>;
}

// Spesifikasi ISO/IEC 18004 Error Correction Level L (Versions 1..12)
const VERSION_SPECS_L: ReadonlyArray<VersionSpec> = [
  { version: 1, totalCodewords: 26, ecCodewordsPerBlock: 7, numBlocksGroup1: 1, dataCodewordsGroup1: 19, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [] },
  { version: 2, totalCodewords: 44, ecCodewordsPerBlock: 10, numBlocksGroup1: 1, dataCodewordsGroup1: 34, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewordsPerBlock: 15, numBlocksGroup1: 1, dataCodewordsGroup1: 55, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewordsPerBlock: 20, numBlocksGroup1: 1, dataCodewordsGroup1: 80, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewordsPerBlock: 26, numBlocksGroup1: 1, dataCodewordsGroup1: 108, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewordsPerBlock: 18, numBlocksGroup1: 2, dataCodewordsGroup1: 68, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewordsPerBlock: 20, numBlocksGroup1: 2, dataCodewordsGroup1: 78, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewordsPerBlock: 24, numBlocksGroup1: 2, dataCodewordsGroup1: 97, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewordsPerBlock: 30, numBlocksGroup1: 2, dataCodewordsGroup1: 116, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewordsPerBlock: 18, numBlocksGroup1: 2, dataCodewordsGroup1: 68, numBlocksGroup2: 2, dataCodewordsGroup2: 69, alignmentPatterns: [6, 28, 50] },
  { version: 11, totalCodewords: 404, ecCodewordsPerBlock: 20, numBlocksGroup1: 4, dataCodewordsGroup1: 81, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentPatterns: [6, 30, 54] },
  { version: 12, totalCodewords: 466, ecCodewordsPerBlock: 24, numBlocksGroup1: 2, dataCodewordsGroup1: 92, numBlocksGroup2: 2, dataCodewordsGroup2: 93, alignmentPatterns: [6, 32, 58] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255] ?? 0;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0;
}

function getGeneratorPolynomial(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i] ?? 1;
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] ?? 0) ^ (poly[j] ?? 0);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j] ?? 0, factor);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonEc(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = getGeneratorPolynomial(ecLength);
  const msg = new Uint8Array(data.length + ecLength);
  msg.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i] ?? 0;
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] = (msg[i + j] ?? 0) ^ gfMul(gen[j] ?? 0, coef);
      }
    }
  }
  return msg.slice(data.length);
}

function selectVersion(byteLength: number): VersionSpec {
  for (const spec of VERSION_SPECS_L) {
    const totalDataCodewords =
      spec.numBlocksGroup1 * spec.dataCodewordsGroup1 +
      spec.numBlocksGroup2 * spec.dataCodewordsGroup2;
    const countIndicatorBits = spec.version <= 9 ? 8 : 16;
    const maxBits = totalDataCodewords * 8;
    const requiredBits = 4 + countIndicatorBits + byteLength * 8;
    if (requiredBits <= maxBits) {
      return spec;
    }
  }
  throw new Error(
    `Data QR terlalu panjang (${byteLength} byte, maksimal 367 byte).`
  );
}

function encodeDataCodewords(
  bytes: Uint8Array,
  spec: VersionSpec
): Uint8Array {
  const totalDataCodewords =
    spec.numBlocksGroup1 * spec.dataCodewordsGroup1 +
    spec.numBlocksGroup2 * spec.dataCodewordsGroup2;
  const bits: number[] = [];

  function pushBits(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  }

  // Byte mode indicator = 0100
  pushBits(0b0100, 4);
  pushBits(bytes.length, spec.version <= 9 ? 8 : 16);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  const maxBits = totalDataCodewords * 8;
  const terminatorLength = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLength);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(totalDataCodewords);
  const byteCount = bits.length / 8;
  for (let i = 0; i < byteCount; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | (bits[i * 8 + b] ?? 0);
    }
    codewords[i] = val;
  }

  const padBytes = [0xec, 0x11];
  for (let i = byteCount; i < totalDataCodewords; i++) {
    codewords[i] = padBytes[(i - byteCount) % 2] ?? 0xec;
  }

  return codewords;
}

function interleaveCodewords(
  dataCodewords: Uint8Array,
  spec: VersionSpec
): Uint8Array {
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < spec.numBlocksGroup1; i++) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewordsGroup1);
    offset += spec.dataCodewordsGroup1;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonEc(block, spec.ecCodewordsPerBlock));
  }

  for (let i = 0; i < spec.numBlocksGroup2; i++) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewordsGroup2);
    offset += spec.dataCodewordsGroup2;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonEc(block, spec.ecCodewordsPerBlock));
  }

  const result = new Uint8Array(spec.totalCodewords);
  let idx = 0;
  const maxDataLen = Math.max(
    spec.dataCodewordsGroup1,
    spec.dataCodewordsGroup2
  );

  for (let col = 0; col < maxDataLen; col++) {
    for (const block of dataBlocks) {
      if (col < block.length) {
        result[idx++] = block[col] ?? 0;
      }
    }
  }

  for (let col = 0; col < spec.ecCodewordsPerBlock; col++) {
    for (const block of ecBlocks) {
      result[idx++] = block[col] ?? 0;
    }
  }

  return result;
}

export function generateQrMatrix(text: string): boolean[][] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Teks QR Code tidak boleh kosong.");
  }

  const bytes = new TextEncoder().encode(trimmed);
  const spec = selectVersion(bytes.length);
  const size = spec.version * 4 + 17;

  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  function setFunctionModule(r: number, c: number, dark: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      const rowMod = modules[r];
      const rowFn = isFunction[r];
      if (rowMod && rowFn) {
        rowMod[c] = dark;
        rowFn[c] = true;
      }
    }
  }

  function drawFinderPattern(topR: number, leftC: number) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter =
          dr >= 0 &&
          dr <= 6 &&
          dc >= 0 &&
          dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter || inInner);
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const align = spec.alignmentPatterns;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0)
      ) {
        continue;
      }
      const centerR = align[i] ?? 0;
      const centerC = align[j] ?? 0;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.abs(dr) === 2 ||
            Math.abs(dc) === 2 ||
            (dr === 0 && dc === 0);
          setFunctionModule(centerR + dr, centerC + dc, dark);
        }
      }
    }
  }

  // Dark module & reserved format info areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      if (!isFunction[8]?.[i]) setFunctionModule(8, i, false);
      if (!isFunction[i]?.[8]) setFunctionModule(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8]?.[size - 1 - i]) {
      setFunctionModule(8, size - 1 - i, false);
    }
    if (!isFunction[size - 1 - i]?.[8]) {
      setFunctionModule(size - 1 - i, 8, false);
    }
  }

  // Version info (untuk version >= 7)
  if (spec.version >= 7) {
    let rem = spec.version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const verBits = (spec.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((verBits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(b, a, bit);
      setFunctionModule(a, b, bit);
    }
  }

  // Place data bits
  const dataCw = encodeDataCodewords(bytes, spec);
  const allCw = interleaveCodewords(dataCw, spec);

  let bitIdx = 0;
  const totalBits = allCw.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r]?.[c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const cwByte = allCw[bitIdx >>> 3] ?? 0;
            dark = ((cwByte >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) {
            dark = !dark;
          }
          const rowMod = modules[r];
          if (rowMod) {
            rowMod[c] = dark;
          }
        }
      }
    }
    upward = !upward;
  }

  // Format information untuk Level L (01) + Mask 0 (000) -> 0b01000
  // BCH + XOR mask 0x5412 = 0x77c4 (30660)
  const formatBits = 0x77c4;
  for (let i = 0; i <= 5; i++) {
    setFunctionModule(8, i, ((formatBits >>> i) & 1) !== 0);
  }
  setFunctionModule(8, 7, ((formatBits >>> 6) & 1) !== 0);
  setFunctionModule(8, 8, ((formatBits >>> 7) & 1) !== 0);
  setFunctionModule(7, 8, ((formatBits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) {
    setFunctionModule(14 - i, 8, ((formatBits >>> i) & 1) !== 0);
  }

  for (let i = 0; i < 8; i++) {
    setFunctionModule(8, size - 1 - i, ((formatBits >>> i) & 1) !== 0);
  }
  for (let i = 8; i < 15; i++) {
    setFunctionModule(size - 15 + i, 8, ((formatBits >>> i) & 1) !== 0);
  }

  return modules;
}

/**
 * Menghasilkan string SVG lengkap untuk QR Code dengan quiet zone (margin).
 */
export function generateQrSvgString(text: string, margin = 2): string {
  const matrix = generateQrMatrix(text);
  const size = matrix.length;
  const totalSize = size + margin * 2;

  const paths: string[] = [];
  for (let r = 0; r < size; r++) {
    const row = matrix[r];
    if (!row) continue;
    for (let c = 0; c < size; c++) {
      if (row[c]) {
        paths.push(`M${c + margin},${r + margin}h1v1h-1z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges"><rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/><path d="${paths.join("")}" fill="#09090b"/></svg>`;
}
