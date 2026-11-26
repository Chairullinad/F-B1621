import { formatDateTimeWIB } from "./datetime.ts";
import { formatRupiah } from "./money.ts";
import type { OrderReceiptDetail } from "../server/cashier.ts";

export type ReceiptPaperSize = "58mm" | "80mm";
export type ReceiptPrintMode = "both" | "customer" | "kitchen";

export const ESC_POS_COLUMN_WIDTHS: Record<ReceiptPaperSize, number> = {
  "58mm": 32,
  "80mm": 48,
};

const CMD_INIT = [0x1b, 0x40] as const;
const CMD_ALIGN_LEFT = [0x1b, 0x61, 0x00] as const;
const CMD_ALIGN_CENTER = [0x1b, 0x61, 0x01] as const;
const CMD_BOLD_ON = [0x1b, 0x45, 0x01] as const;
const CMD_BOLD_OFF = [0x1b, 0x45, 0x00] as const;
const CMD_SIZE_NORMAL = [0x1d, 0x21, 0x00] as const;
const CMD_SIZE_DOUBLE_HEIGHT = [0x1d, 0x21, 0x01] as const;
const CMD_SIZE_DOUBLE_BOTH = [0x1d, 0x21, 0x11] as const;
const CMD_FEED_AND_CUT = [0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00] as const;
const CMD_NEWLINE = [0x0a] as const;

export function getEscPosColumnWidth(paperSize: ReceiptPaperSize): number {
  return ESC_POS_COLUMN_WIDTHS[paperSize];
}

/**
 * Membersihkan karakter agar aman dicetak oleh mayoritas printer thermal ESC/POS (ASCII printable).
 */
export function sanitizeEscPosText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[•·]/g, "-")
    .replace(/[—–−]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Membungkus teks panjang agar tidak melebihi jumlah kolom kertas thermal.
 */
export function wrapEscPosText(text: string, maxWidth: number): string[] {
  const clean = sanitizeEscPosText(text);
  if (!clean) return [];
  if (maxWidth <= 0) return [clean];

  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxWidth) {
        lines.push(word.slice(i, i + maxWidth));
      }
      continue;
    }

    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

/**
 * Memformat pasangan label kiri dan nilai kanan agar sejajar di lebar kertas thermal.
 */
export function formatEscPosColumns(
  leftRaw: string,
  rightRaw: string,
  width: number
): string[] {
  const left = sanitizeEscPosText(leftRaw);
  const right = sanitizeEscPosText(rightRaw);

  if (!right) {
    return wrapEscPosText(left, width);
  }

  if (left.length + 1 + right.length <= width) {
    const spaces = " ".repeat(width - left.length - right.length);
    return [`${left}${spaces}${right}`];
  }

  const wrappedLeft = wrapEscPosText(left, width);
  if (wrappedLeft.length === 0) {
    return [right.padStart(width, " ")];
  }

  const lastIdx = wrappedLeft.length - 1;
  const lastLine = wrappedLeft[lastIdx] ?? "";
  if (lastLine.length + 1 + right.length <= width) {
    wrappedLeft[lastIdx] = `${lastLine}${" ".repeat(
      width - lastLine.length - right.length
    )}${right}`;
    return wrappedLeft;
  }

  wrappedLeft.push(
    right.length >= width ? right.slice(0, width) : right.padStart(width, " ")
  );
  return wrappedLeft;
}

function formatDivider(char: "-" | "=", width: number): string {
  return char.repeat(width);
}

function centerText(text: string, width: number): string[] {
  return wrapEscPosText(text, width);
}

class EscPosBufferBuilder {
  private readonly chunks: number[] = [];

  appendBytes(bytes: readonly number[]): this {
    for (const b of bytes) {
      this.chunks.push(b & 0xff);
    }
    return this;
  }

  appendAsciiLine(line: string): this {
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      this.chunks.push(code >= 0x20 && code <= 0x7e ? code : 0x20);
    }
    this.appendBytes(CMD_NEWLINE);
    return this;
  }

  appendWrappedLines(
    text: string,
    width: number,
    options?: { align?: "left" | "center"; bold?: boolean }
  ): this {
    if (options?.align === "center") {
      this.appendBytes(CMD_ALIGN_CENTER);
    } else {
      this.appendBytes(CMD_ALIGN_LEFT);
    }
    if (options?.bold) {
      this.appendBytes(CMD_BOLD_ON);
    }

    for (const line of wrapEscPosText(text, width)) {
      this.appendAsciiLine(line);
    }

    if (options?.bold) {
      this.appendBytes(CMD_BOLD_OFF);
    }
    return this;
  }

  appendColumns(
    left: string,
    right: string,
    width: number,
    options?: { bold?: boolean }
  ): this {
    this.appendBytes(CMD_ALIGN_LEFT);
    if (options?.bold) {
      this.appendBytes(CMD_BOLD_ON);
    }
    for (const line of formatEscPosColumns(left, right, width)) {
      this.appendAsciiLine(line);
    }
    if (options?.bold) {
      this.appendBytes(CMD_BOLD_OFF);
    }
    return this;
  }

  appendDivider(char: "-" | "=", width: number): this {
    this.appendBytes(CMD_ALIGN_LEFT);
    this.appendAsciiLine(formatDivider(char, width));
    return this;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

export interface BuildEscPosReceiptOptions {
  paperSize: ReceiptPaperSize;
  mode: ReceiptPrintMode;
}

/**
 * Menghasilkan representasi baris teks ASCII dari struk (bermanfaat untuk preview/unit test).
 */
export function buildOrderReceiptTextLines(
  receipt: OrderReceiptDetail,
  options: BuildEscPosReceiptOptions
): string[] {
  const width = getEscPosColumnWidth(options.paperSize);
  const lines: string[] = [];
  const waktuWib = formatDateTimeWIB(receipt.paidAt ?? receipt.createdAt);
  const tableOrType =
    receipt.orderType === "takeaway" ? "Takeaway / Bungkus" : receipt.tableName;
  const paymentLabel = receipt.paymentMethod === "qris" ? "QRIS" : "TUNAI";

  if (options.mode === "both" || options.mode === "customer") {
    lines.push(...centerText(receipt.outletName.toUpperCase(), width));
    if (receipt.outletAddress) {
      lines.push(...centerText(receipt.outletAddress, width));
    }
    lines.push(formatDivider("-", width));

    lines.push(...formatEscPosColumns("No. Order", `#${receipt.orderNo}`, width));
    lines.push(...formatEscPosColumns("Waktu", waktuWib, width));
    lines.push(...formatEscPosColumns("Kasir", receipt.cashierName, width));
    lines.push(...formatEscPosColumns("Meja / Tipe", tableOrType, width));
    lines.push(...formatEscPosColumns("Metode Bayar", paymentLabel, width));
    lines.push(formatDivider("-", width));

    for (const item of receipt.items) {
      lines.push(...wrapEscPosText(item.productName, width));
      lines.push(
        ...formatEscPosColumns(
          `${item.qty} x ${formatRupiah(item.unitPrice)}`,
          formatRupiah(item.lineTotal),
          width
        )
      );
      if (item.note) {
        lines.push(...wrapEscPosText(`* Catatan: ${item.note}`, width));
      }
    }

    lines.push(formatDivider("-", width));
    lines.push(
      ...formatEscPosColumns("Subtotal", formatRupiah(receipt.subtotal), width)
    );

    if (receipt.discount > 0) {
      const discountLabel = receipt.discountReason
        ? `Diskon (${receipt.discountReason})`
        : "Diskon";
      lines.push(
        ...formatEscPosColumns(
          discountLabel,
          `- ${formatRupiah(receipt.discount)}`,
          width
        )
      );
    }

    if (receipt.serviceAmount > 0 && receipt.serviceRate !== null) {
      lines.push(
        ...formatEscPosColumns(
          `Service (${receipt.serviceRate}%)`,
          formatRupiah(receipt.serviceAmount),
          width
        )
      );
    }

    if (receipt.taxAmount > 0 && receipt.taxRate !== null) {
      const taxLabel = `Pajak (${receipt.taxRate}%${
        receipt.priceIncludesTax ? " Termasuk" : ""
      })`;
      lines.push(
        ...formatEscPosColumns(taxLabel, formatRupiah(receipt.taxAmount), width)
      );
    }

    lines.push(formatDivider("=", width));
    lines.push(
      ...formatEscPosColumns("TOTAL", formatRupiah(receipt.total), width)
    );
    lines.push(
      ...formatEscPosColumns(
        `Bayar (${receipt.paymentMethod === "qris" ? "QRIS" : "Tunai"})`,
        formatRupiah(receipt.amountReceived),
        width
      )
    );
    lines.push(
      ...formatEscPosColumns("Kembali", formatRupiah(receipt.changeAmount), width)
    );

    if (receipt.refund) {
      lines.push(formatDivider("-", width));
      lines.push(
        ...centerText(
          `*** DIBATALKAN / REFUND ${formatRupiah(receipt.refund.amount)} ***`,
          width
        )
      );
      lines.push(...wrapEscPosText(`Alasan: ${receipt.refund.reason}`, width));
    }

    lines.push(formatDivider("-", width));
    lines.push(
      ...centerText(
        receipt.receiptFooter ?? "Terima kasih atas kunjungan Anda di 1621 Group!",
        width
      )
    );
  }

  if (options.mode === "both") {
    lines.push("");
    lines.push(...centerText("--- POTONG UNTUK KITCHEN ---", width));
    lines.push("");
  }

  if (options.mode === "both" || options.mode === "kitchen") {
    const totalQty = receipt.items.reduce((acc, item) => acc + item.qty, 0);
    lines.push(...centerText("*** TIKET ANTREAN KITCHEN ***", width));
    lines.push(...centerText(receipt.outletName.toUpperCase(), width));
    lines.push(
      ...centerText(
        receipt.orderType === "takeaway"
          ? "TAKEAWAY / BUNGKUS"
          : receipt.tableName.toUpperCase(),
        width
      )
    );
    lines.push(...centerText(`ANTREAN #${receipt.orderNo}`, width));
    lines.push(formatDivider("-", width));
    lines.push(...formatEscPosColumns("Jam Masuk", waktuWib, width));
    lines.push(...formatEscPosColumns("Kasir", receipt.cashierName, width));
    lines.push(
      ...formatEscPosColumns("Total Porsi", `${totalQty} item`, width)
    );
    lines.push(formatDivider("=", width));

    for (const item of receipt.items) {
      lines.push(...wrapEscPosText(`[ ] ${item.qty}x ${item.productName}`, width));
      if (item.note) {
        lines.push(...wrapEscPosText(`  CATATAN: ${item.note}`, width));
      }
    }

    lines.push(formatDivider("=", width));
    lines.push(
      ...centerText("CEK KESESUAIAN PESANAN SEBELUM DIANTAR", width)
    );
  }

  return lines;
}

/**
 * Mengonversi OrderReceiptDetail menjadi perintah byte ESC/POS siap kirim ke printer thermal Bluetooth.
 */
export function buildOrderReceiptEscPosBytes(
  receipt: OrderReceiptDetail,
  options: BuildEscPosReceiptOptions
): Uint8Array {
  const width = getEscPosColumnWidth(options.paperSize);
  const builder = new EscPosBufferBuilder();
  const waktuWib = formatDateTimeWIB(receipt.paidAt ?? receipt.createdAt);
  const tableOrType =
    receipt.orderType === "takeaway" ? "Takeaway / Bungkus" : receipt.tableName;
  const paymentLabel = receipt.paymentMethod === "qris" ? "QRIS" : "TUNAI";

  builder.appendBytes(CMD_INIT).appendBytes(CMD_SIZE_NORMAL);

  if (options.mode === "both" || options.mode === "customer") {
    builder
      .appendBytes(CMD_ALIGN_CENTER)
      .appendBytes(CMD_BOLD_ON)
      .appendBytes(CMD_SIZE_DOUBLE_HEIGHT);
    for (const line of wrapEscPosText(receipt.outletName.toUpperCase(), width)) {
      builder.appendAsciiLine(line);
    }
    builder.appendBytes(CMD_SIZE_NORMAL).appendBytes(CMD_BOLD_OFF);

    if (receipt.outletAddress) {
      builder.appendWrappedLines(receipt.outletAddress, width, {
        align: "center",
      });
    }

    builder.appendDivider("-", width);
    builder.appendColumns("No. Order", `#${receipt.orderNo}`, width, {
      bold: true,
    });
    builder.appendColumns("Waktu", waktuWib, width);
    builder.appendColumns("Kasir", receipt.cashierName, width);
    builder.appendColumns("Meja / Tipe", tableOrType, width, { bold: true });
    builder.appendColumns("Metode Bayar", paymentLabel, width, { bold: true });
    builder.appendDivider("-", width);

    for (const item of receipt.items) {
      builder.appendWrappedLines(item.productName, width, { bold: true });
      builder.appendColumns(
        `${item.qty} x ${formatRupiah(item.unitPrice)}`,
        formatRupiah(item.lineTotal),
        width
      );
      if (item.note) {
        builder.appendWrappedLines(`* Catatan: ${item.note}`, width);
      }
    }

    builder.appendDivider("-", width);
    builder.appendColumns("Subtotal", formatRupiah(receipt.subtotal), width);

    if (receipt.discount > 0) {
      const discountLabel = receipt.discountReason
        ? `Diskon (${receipt.discountReason})`
        : "Diskon";
      builder.appendColumns(
        discountLabel,
        `- ${formatRupiah(receipt.discount)}`,
        width
      );
    }

    if (receipt.serviceAmount > 0 && receipt.serviceRate !== null) {
      builder.appendColumns(
        `Service (${receipt.serviceRate}%)`,
        formatRupiah(receipt.serviceAmount),
        width
      );
    }

    if (receipt.taxAmount > 0 && receipt.taxRate !== null) {
      const taxLabel = `Pajak (${receipt.taxRate}%${
        receipt.priceIncludesTax ? " Termasuk" : ""
      })`;
      builder.appendColumns(taxLabel, formatRupiah(receipt.taxAmount), width);
    }

    builder.appendDivider("=", width);
    builder.appendColumns("TOTAL", formatRupiah(receipt.total), width, {
      bold: true,
    });
    builder.appendColumns(
      `Bayar (${receipt.paymentMethod === "qris" ? "QRIS" : "Tunai"})`,
      formatRupiah(receipt.amountReceived),
      width
    );
    builder.appendColumns("Kembali", formatRupiah(receipt.changeAmount), width, {
      bold: true,
    });

    if (receipt.refund) {
      builder.appendDivider("-", width);
      builder.appendWrappedLines(
        `*** DIBATALKAN / REFUND ${formatRupiah(receipt.refund.amount)} ***`,
        width,
        { align: "center", bold: true }
      );
      builder.appendWrappedLines(`Alasan: ${receipt.refund.reason}`, width, {
        align: "center",
      });
    }

    builder.appendDivider("-", width);
    builder.appendWrappedLines(
      receipt.receiptFooter ?? "Terima kasih atas kunjungan Anda di 1621 Group!",
      width,
      { align: "center" }
    );
  }

  if (options.mode === "both") {
    builder
      .appendBytes(CMD_NEWLINE)
      .appendWrappedLines("--- POTONG UNTUK KITCHEN ---", width, {
        align: "center",
        bold: true,
      })
      .appendBytes(CMD_NEWLINE);
  }

  if (options.mode === "both" || options.mode === "kitchen") {
    const totalQty = receipt.items.reduce((acc, item) => acc + item.qty, 0);
    builder.appendWrappedLines("*** TIKET ANTREAN KITCHEN ***", width, {
      align: "center",
      bold: true,
    });
    builder.appendWrappedLines(receipt.outletName.toUpperCase(), width, {
      align: "center",
      bold: true,
    });

    builder
      .appendBytes(CMD_ALIGN_CENTER)
      .appendBytes(CMD_BOLD_ON)
      .appendBytes(CMD_SIZE_DOUBLE_BOTH);
    const tableBanner =
      receipt.orderType === "takeaway"
        ? "TAKEAWAY"
        : receipt.tableName.toUpperCase();
    for (const line of wrapEscPosText(
      tableBanner,
      Math.max(12, Math.floor(width / 2))
    )) {
      builder.appendAsciiLine(line);
    }
    builder.appendBytes(CMD_SIZE_NORMAL);
    builder.appendWrappedLines(`ANTREAN #${receipt.orderNo}`, width, {
      align: "center",
      bold: true,
    });

    builder.appendDivider("-", width);
    builder.appendColumns("Jam Masuk", waktuWib, width);
    builder.appendColumns("Kasir", receipt.cashierName, width);
    builder.appendColumns("Total Porsi", `${totalQty} item`, width, {
      bold: true,
    });
    builder.appendDivider("=", width);

    for (const item of receipt.items) {
      builder.appendWrappedLines(`[ ] ${item.qty}x ${item.productName}`, width, {
        bold: true,
      });
      if (item.note) {
        builder.appendWrappedLines(`  CATATAN: ${item.note}`, width, {
          bold: true,
        });
      }
    }

    builder.appendDivider("=", width);
    builder.appendWrappedLines(
      "CEK KESESUAIAN PESANAN SEBELUM DIANTAR",
      width,
      { align: "center", bold: true }
    );
  }

  builder.appendBytes(CMD_FEED_AND_CUT);
  return builder.toUint8Array();
}

/**
 * Membuat payload Test Print Bluetooth ESC/POS untuk mengecek lebar kertas dan koneksi printer.
 */
export function buildBluetoothTestPrintEscPosBytes(
  paperSize: ReceiptPaperSize,
  printerName?: string
): Uint8Array {
  const width = getEscPosColumnWidth(paperSize);
  const builder = new EscPosBufferBuilder();

  builder
    .appendBytes(CMD_INIT)
    .appendBytes(CMD_SIZE_NORMAL)
    .appendWrappedLines("f&b1621 POS", width, { align: "center", bold: true })
    .appendWrappedLines("TES CETAK PRINTER BLUETOOTH", width, {
      align: "center",
      bold: true,
    })
    .appendDivider("=", width)
    .appendColumns("Ukuran Kertas", `${paperSize} (${width} col)`, width)
    .appendColumns(
      "Printer",
      printerName ? sanitizeEscPosText(printerName) : "Thermal Bluetooth",
      width
    )
    .appendColumns("Waktu WIB", formatDateTimeWIB(new Date()), width)
    .appendDivider("-", width)
    .appendWrappedLines(
      "123456789012345678901234567890123456789012345678".slice(0, width),
      width
    )
    .appendWrappedLines("Koneksi printer thermal siap digunakan!", width, {
      align: "center",
      bold: true,
    })
    .appendBytes(CMD_FEED_AND_CUT);

  return builder.toUint8Array();
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Mengonversi Uint8Array ESC/POS ke Base64 tanpa ketergantungan global Buffer/atob.
 */
export function encodeEscPosBytesToBase64(bytes: Uint8Array): string {
  let output = "";
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < len ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < len ? (bytes[i + 2] ?? 0) : 0;

    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += BASE64_ALPHABET[(triplet >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triplet >> 12) & 0x3f];
    output +=
      i + 1 < len ? BASE64_ALPHABET[(triplet >> 6) & 0x3f] : "=";
    output += i + 2 < len ? BASE64_ALPHABET[triplet & 0x3f] : "=";
  }

  return output;
}
