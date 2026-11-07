import { assertIntegerRupiah } from "./money.ts";

/**
 * src/lib/qris.ts
 * Konverter QRIS Statis (EMVCo Bank Indonesia) menjadi QRIS Bernominal Otomatis
 * dengan nominal murni (total Rupiah) dan label referensi nomor meja (MEJA-<no>).
 */

export interface EmvTag {
  id: string;
  value: string;
}

export interface GenerateDynamicQrisInput {
  staticQrisPayload: string;
  amountRupiah: number;
  tableNo?: number;
  orderNo?: string;
}

/**
 * Hitung checksum CRC16-CCITT (0xFFFF, polynomial 0x1021) sesuai spesifikasi EMVCo QRIS.
 */
export function computeQrisCrc16(payloadWithoutCrcValue: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payloadWithoutCrcValue.length; i++) {
    crc ^= payloadWithoutCrcValue.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatTlv(id: string, value: string): string {
  const lengthStr = value.length.toString().padStart(2, "0");
  return `${id}${lengthStr}${value}`;
}

/**
 * Parse string TLV EMVCo menjadi daftar tag berurutan.
 */
export function parseEmvTags(rawPayload: string): EmvTag[] {
  const trimmed = rawPayload.trim();
  if (!trimmed.startsWith("000201")) {
    throw new Error("Payload QRIS tidak valid (harus diawali '000201').");
  }

  const tags: EmvTag[] = [];
  let cursor = 0;

  while (cursor < trimmed.length) {
    if (cursor + 4 > trimmed.length) {
      throw new Error("Struktur TLV QRIS rusak.");
    }
    const id = trimmed.slice(cursor, cursor + 2);
    const len = Number.parseInt(trimmed.slice(cursor + 2, cursor + 4), 10);
    if (!Number.isFinite(len) || len < 0 || cursor + 4 + len > trimmed.length) {
      throw new Error(`Panjang nilai TLV tidak valid pada tag ${id}.`);
    }
    const value = trimmed.slice(cursor + 4, cursor + 4 + len);
    tags.push({ id, value });
    cursor += 4 + len;
  }

  return tags;
}

/**
 * Ubah QRIS Statis toko menjadi QRIS dengan nominal terkunci (murni sesuai total)
 * dan sisipkan label meja (contoh: MEJA-07) pada Tag 62.
 */
export function generateDynamicQrisPayload(
  input: GenerateDynamicQrisInput
): string {
  assertIntegerRupiah(input.amountRupiah, "Nominal QRIS");
  if (input.amountRupiah <= 0) {
    throw new Error("Nominal QRIS harus lebih dari Rp 0.");
  }

  const originalTags = parseEmvTags(input.staticQrisPayload);

  // Buang tag 01 (Point of Initiation), 54 (Amount), 62 (Additional Data), dan 63 (CRC) lama
  // untuk dibangun ulang secara deterministik.
  const filteredTags: EmvTag[] = [];
  let insertedAmount = false;

  for (const tag of originalTags) {
    if (tag.id === "63") {
      continue;
    }
    if (tag.id === "01") {
      // Ubah 11 (Statis) menjadi 12 (Dinamis / dengan nominal)
      filteredTags.push({ id: "01", value: "12" });
      continue;
    }
    if (tag.id === "54") {
      continue;
    }
    if (tag.id === "58" && !insertedAmount) {
      filteredTags.push({
        id: "54",
        value: String(input.amountRupiah),
      });
      insertedAmount = true;
    }
    if (tag.id === "62" && (input.tableNo !== undefined || input.orderNo)) {
      continue;
    }
    filteredTags.push(tag);
  }

  if (!insertedAmount) {
    filteredTags.push({
      id: "54",
      value: String(input.amountRupiah),
    });
  }

  // Sisipkan Tag 62 (Additional Data Field Template) dengan Reference Label MEJA-<no>
  if (input.tableNo !== undefined || input.orderNo) {
    const tablePart =
      input.tableNo !== undefined
        ? `MEJA-${String(input.tableNo).padStart(2, "0")}`
        : "";
    const orderPart = input.orderNo ? input.orderNo.slice(-8) : "";
    const refLabel = [tablePart, orderPart]
      .filter(Boolean)
      .join("-")
      .slice(0, 25);

    if (refLabel.length > 0) {
      // Sub-tag 05: Reference Label, Sub-tag 07: Terminal Label
      const subTag05 = formatTlv("05", refLabel);
      const subTag07 =
        tablePart.length > 0 ? formatTlv("07", tablePart) : "";
      filteredTags.push({
        id: "62",
        value: `${subTag05}${subTag07}`,
      });
    }
  }

  const body = filteredTags.map((t) => formatTlv(t.id, t.value)).join("");
  const payloadWithCrcHeader = `${body}6304`;
  const crc = computeQrisCrc16(payloadWithCrcHeader);

  return `${payloadWithCrcHeader}${crc}`;
}

