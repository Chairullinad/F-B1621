import type { PaymentMethod } from "./types/database.ts";

/**
 * Nilai fallback historis; ketersediaan QRIS pelanggan kini mengikuti saklar `qris_enabled` per outlet.
 */
export const CUSTOMER_QRIS_UNDER_MAINTENANCE = false;

export type CustomerPaymentValidationResult =
  | { ok: true; paymentChoice: PaymentMethod }
  | { ok: false; message: string };

/**
 * Menentukan apakah pembayaran QRIS di meja untuk suatu outlet sedang nonaktif / belum siap dipakai.
 */
export function isOutletQrisDisabled(outlet: {
  qris_enabled?: unknown;
  qris_raw_payload?: unknown;
}): boolean {
  const enabled = Boolean(outlet.qris_enabled);
  const hasPayload =
    typeof outlet.qris_raw_payload === "string" &&
    outlet.qris_raw_payload.trim().length > 0;
  return !enabled || !hasPayload;
}

/**
 * Memvalidasi metode pembayaran yang dipilih pelanggan sebelum order disimpan ke server.
 */
export function resolveCustomerPaymentChoice(
  requestedChoice: PaymentMethod,
  isQrisDisabled = CUSTOMER_QRIS_UNDER_MAINTENANCE
): CustomerPaymentValidationResult {
  if (isQrisDisabled && requestedChoice === "qris") {
    return {
      ok: false,
      message:
        "Pembayaran QRIS di meja sedang dinonaktifkan oleh outlet. Silakan pilih Bayar di Kasir.",
    };
  }
  return {
    ok: true,
    paymentChoice: requestedChoice,
  };
}
