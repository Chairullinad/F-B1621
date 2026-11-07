/**
 * src/lib/money.ts
 * SATU-SATUNYA tempat hitung total, diskon, service charge, pajak, kembalian,
 * pembulatan Rupiah, dan format mata uang di seluruh aplikasi.
 *
 * Aturan Bisnis (PRD Bagian 7 & AGENTS.md):
 * - Semua nominal uang disimpan dan dihitung sebagai integer Rupiah (bukan float).
 * - Tampilan mata uang: "Rp 25.000".
 * - Pajak dan service charge mati secara default (persentase null).
 * - Saklar tidak bisa dinyalakan sebelum persentase diisi.
 * - Mode belum termasuk (priceIncludesTax = false):
 *     service = % x (subtotal - diskon)
 *     pajak   = % x (subtotal - diskon + service)
 *     total   = (subtotal - diskon) + service + pajak
 * - Mode sudah termasuk (priceIncludesTax = true):
 *     total tidak ditambah pajak; pajak hanya dihitung sebagai komponen harga untuk struk.
 */

export interface OrderLineInput {
  unitPrice: number;
  qty: number;
}

export interface TaxAndServiceConfig {
  taxEnabled: boolean;
  taxPercent: number | null;
  serviceEnabled: boolean;
  servicePercent: number | null;
  priceIncludesTax: boolean;
}

export type DiscountInput =
  | { type: "none" }
  | { type: "amount"; value: number }
  | { type: "percent"; value: number };

export interface CalculateOrderTotalsInput {
  items: ReadonlyArray<OrderLineInput>;
  discount?: DiscountInput;
  config: TaxAndServiceConfig;
}

export interface OrderTotalsResult {
  subtotal: number;
  discount: number;
  taxableBase: number;
  serviceRate: number | null;
  serviceAmount: number;
  taxRate: number | null;
  taxAmount: number;
  priceIncludesTax: boolean;
  total: number;
}

/**
 * Validasi bahwa nilai adalah integer Rupiah non-negatif.
 */
export function assertIntegerRupiah(value: number, fieldName = "Nominal"): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${fieldName} harus berupa bilangan bulat Rupiah.`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} tidak boleh negatif.`);
  }
}

/**
 * Satu-satunya fungsi pembulatan ke bilangan bulat Rupiah.
 */
export function roundRupiah(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Nilai pembulatan tidak valid.");
  }
  return Math.round(value);
}

/**
 * Format integer Rupiah menjadi "Rp 25.000" (atau "-Rp 25.000" jika negatif).
 */
export function formatRupiah(amount: number): string {
  const rounded = roundRupiah(amount);
  const isNegative = rounded < 0;
  const absoluteValue = Math.abs(rounded);
  const formattedNumber = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(absoluteValue);

  return isNegative ? `-Rp ${formattedNumber}` : `Rp ${formattedNumber}`;
}

/**
 * Hitung total per baris item (unit_price * qty).
 */
export function calculateLineTotal(unitPrice: number, qty: number): number {
  assertIntegerRupiah(unitPrice, "Harga satuan");
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error("Jumlah item (qty) harus bilangan bulat lebih dari 0.");
  }
  return unitPrice * qty;
}

/**
 * Validasi konfigurasi pajak & service charge.
 * Saklar tidak boleh menyala jika persentase belum diisi.
 */
export function validateTaxAndServiceConfig(config: TaxAndServiceConfig): void {
  if (config.taxEnabled) {
    if (
      config.taxPercent === null ||
      !Number.isFinite(config.taxPercent) ||
      config.taxPercent <= 0 ||
      config.taxPercent > 100
    ) {
      throw new Error(
        "Saklar pajak tidak dapat dinyalakan sebelum persentase pajak diisi (1-100%)."
      );
    }
  }

  if (config.serviceEnabled) {
    if (
      config.servicePercent === null ||
      !Number.isFinite(config.servicePercent) ||
      config.servicePercent <= 0 ||
      config.servicePercent > 100
    ) {
      throw new Error(
        "Saklar service charge tidak dapat dinyalakan sebelum persentase diisi (1-100%)."
      );
    }
  }
}

/**
 * Hitung nominal diskon dalam Rupiah bulat dari input diskon nominal atau persen.
 */
export function calculateDiscountAmount(
  subtotal: number,
  discount: DiscountInput = { type: "none" }
): number {
  assertIntegerRupiah(subtotal, "Subtotal");

  if (discount.type === "none") {
    return 0;
  }

  if (discount.type === "amount") {
    assertIntegerRupiah(discount.value, "Nominal diskon");
    if (discount.value > subtotal) {
      throw new Error("Nominal diskon tidak boleh melebihi subtotal.");
    }
    return discount.value;
  }

  if (
    !Number.isFinite(discount.value) ||
    discount.value < 0 ||
    discount.value > 100
  ) {
    throw new Error("Persentase diskon harus berada di antara 0 dan 100.");
  }

  return roundRupiah((subtotal * discount.value) / 100);
}

/**
 * Hitung subtotal, diskon, service charge, pajak, dan total akhir order.
 */
export function calculateOrderTotals(
  input: CalculateOrderTotalsInput
): OrderTotalsResult {
  validateTaxAndServiceConfig(input.config);

  const subtotal = input.items.reduce(
    (sum, item) => sum + calculateLineTotal(item.unitPrice, item.qty),
    0
  );

  const discount = calculateDiscountAmount(subtotal, input.discount);
  const afterDiscount = Math.max(0, subtotal - discount);

  const activeServiceRate =
    input.config.serviceEnabled && input.config.servicePercent !== null
      ? input.config.servicePercent
      : null;

  const activeTaxRate =
    input.config.taxEnabled && input.config.taxPercent !== null
      ? input.config.taxPercent
      : null;

  const serviceAmount =
    activeServiceRate !== null
      ? roundRupiah((afterDiscount * activeServiceRate) / 100)
      : 0;

  let taxAmount = 0;
  let total = afterDiscount;

  if (input.config.priceIncludesTax) {
    // Mode harga sudah termasuk pajak:
    // Total tidak berubah oleh pajak; pajak hanya ditampilkan di struk sebagai komponen harga.
    total = afterDiscount + serviceAmount;
    if (activeTaxRate !== null) {
      const baseWithoutTax = total / (1 + activeTaxRate / 100);
      taxAmount = roundRupiah(total - baseWithoutTax);
    }
  } else {
    // Mode harga belum termasuk pajak:
    // service = % x (subtotal - diskon)
    // pajak   = % x (subtotal - diskon + service)
    if (activeTaxRate !== null) {
      taxAmount = roundRupiah(
        ((afterDiscount + serviceAmount) * activeTaxRate) / 100
      );
    }
    total = afterDiscount + serviceAmount + taxAmount;
  }

  return {
    subtotal,
    discount,
    taxableBase: afterDiscount,
    serviceRate: activeServiceRate,
    serviceAmount,
    taxRate: activeTaxRate,
    taxAmount,
    priceIncludesTax: input.config.priceIncludesTax,
    total,
  };
}

/**
 * Hitung kembalian pembayaran tunai.
 * Melempar error jika uang diterima kurang dari total.
 */
export function calculateCashChange(
  total: number,
  amountReceived: number
): number {
  assertIntegerRupiah(total, "Total tagihan");
  assertIntegerRupiah(amountReceived, "Uang diterima");

  if (amountReceived < total) {
    throw new Error(
      `Uang diterima (${formatRupiah(amountReceived)}) tidak boleh kurang dari total (${formatRupiah(total)}).`
    );
  }

  return amountReceived - total;
}

