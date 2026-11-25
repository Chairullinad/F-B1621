import type { PaymentMethod } from "@/lib/types/database";

/**
 * Saklar sementara saat pembayaran QRIS di meja sedang dalam perbaikan.
 * Ubah ke `false` apabila QRIS di meja kembali aktif.
 */
export const CUSTOMER_QRIS_UNDER_MAINTENANCE = true;

export type CustomerPaymentValidationResult =
  | { ok: true; paymentChoice: PaymentMethod }
  | { ok: false; message: string };

/**
 * Memvalidasi metode pembayaran yang dipilih pelanggan sebelum order disimpan ke server.
 */
export function resolveCustomerPaymentChoice(
  requestedChoice: PaymentMethod,
  isQrisUnderMaintenance = CUSTOMER_QRIS_UNDER_MAINTENANCE
): CustomerPaymentValidationResult {
  if (isQrisUnderMaintenance && requestedChoice === "qris") {
    return {
      ok: false,
      message:
        "Pembayaran QRIS di meja sedang dalam perbaikan. Untuk sementara silakan pilih Bayar di Kasir.",
    };
  }
  return {
    ok: true,
    paymentChoice: requestedChoice,
  };
}
