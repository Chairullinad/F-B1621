"use client";

import * as React from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  MessageSquareText,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { formatRupiah } from "@/lib/money";
import type { PaymentMethod, ProductRow } from "@/lib/types/database";

export interface CustomerCartItem {
  product: ProductRow;
  qty: number;
  note: string;
}

interface CustomerCheckoutDetailProps {
  outletName: string;
  tableName: string;
  cart: CustomerCartItem[];
  totals: {
    subtotal: number;
    serviceRate: number | null;
    serviceAmount: number;
    taxRate: number | null;
    taxAmount: number;
    priceIncludesTax: boolean;
    total: number;
  };
  paymentChoice: PaymentMethod;
  isQrisUnderMaintenance: boolean;
  isPending: boolean;
  onBackToMenu: () => void;
  onChangeQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onChangeNote: (productId: string, note: string) => void;
  onSelectPayment: (choice: PaymentMethod) => void;
  onSubmitOrder: () => void;
}

export function CustomerCheckoutDetail({
  outletName,
  tableName,
  cart,
  totals,
  paymentChoice,
  isQrisUnderMaintenance,
  isPending,
  onBackToMenu,
  onChangeQty,
  onRemoveItem,
  onChangeNote,
  onSelectPayment,
  onSubmitOrder,
}: CustomerCheckoutDetailProps) {
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-28 text-slate-900">
      {/* Sticky Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBackToMenu}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Tambah Menu</span>
          </button>

          <div className="text-center min-w-0">
            <h1 className="text-sm font-extrabold text-slate-900 truncate">
              Detail Pesanan
            </h1>
            <p className="text-[11px] font-medium text-slate-500 truncate">
              {outletName} &bull; {tableName}
            </p>
          </div>

          <span className="inline-flex h-8 items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 text-xs font-bold text-[#00884A] shrink-0">
            {totalItems} Item
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {/* Bagian 1: Daftar Item Pesanan & Catatan Dapur */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#00884A]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Pesanan Anda
                </h2>
                <p className="text-[11px] text-slate-500">
                  Periksa menu, jumlah, dan tulis catatan bila perlu
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {cart.map((item) => (
              <div key={item.product.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    {item.product.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.product.name}
                      </h3>
                      <span className="text-sm font-extrabold text-slate-900 shrink-0 tabular-nums">
                        {formatRupiah(item.product.price * item.qty)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatRupiah(item.product.price)} / porsi
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 px-1">
                        <button
                          type="button"
                          onClick={() => onChangeQty(item.product.id, -1)}
                          aria-label={`Kurangi ${item.product.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 hover:bg-white cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-7 text-center text-sm font-extrabold text-slate-900 tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeQty(item.product.id, 1)}
                          aria-label={`Tambah ${item.product.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[#00884A] hover:bg-white cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.product.id)}
                        aria-label={`Hapus ${item.product.name}`}
                        className="inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Input Catatan Dapur */}
                <div className="relative">
                  <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    maxLength={160}
                    value={item.note}
                    onChange={(e) => onChangeNote(item.product.id, e.target.value)}
                    placeholder="Catatan dapur (opsional, misal: tidak pedas, es sedikit)"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#00884A] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onBackToMenu}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[#00884A]" />
            <span>Tambah Menu Lainnya</span>
          </button>
        </section>

        {/* Bagian 2: Pilihan Metode Pembayaran */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Pilihan Pembayaran
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Untuk sementara pembayaran hanya dapat dilakukan secara langsung di kasir.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Opsi 1: Bayar Tunai di Kasir (Aktif) */}
            <button
              type="button"
              onClick={() => onSelectPayment("cash")}
              className={`flex w-full items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition cursor-pointer ${
                paymentChoice === "cash"
                  ? "border-[#00884A] bg-emerald-50/60 shadow-2xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  paymentChoice === "cash"
                    ? "bg-[#00884A] text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <Banknote className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    Bayar di Kasir (Tunai)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Tersedia</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Pesanan Anda langsung masuk antrean kasir. Silakan lakukan pembayaran
                  di meja Kasir maksimal 15 menit setelah pesanan dikirim.
                </p>
              </div>
            </button>

            {/* Opsi 2: QRIS di Meja (Sementara Nonaktif / Sedang Dalam Perbaikan) */}
            <button
              type="button"
              disabled={isQrisUnderMaintenance}
              aria-disabled={isQrisUnderMaintenance}
              onClick={() => {
                if (!isQrisUnderMaintenance) {
                  onSelectPayment("qris");
                }
              }}
              className={`flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                isQrisUnderMaintenance
                  ? "border-amber-200/90 bg-amber-50/45 opacity-90 cursor-not-allowed"
                  : paymentChoice === "qris"
                    ? "border-2 border-[#00884A] bg-emerald-50/60 cursor-pointer"
                    : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-700">
                <QrCode className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    QRIS di Meja
                  </span>
                  {isQrisUnderMaintenance ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                      <Wrench className="h-3 w-3" />
                      <span>Sedang dalam perbaikan</span>
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {isQrisUnderMaintenance
                    ? "Pembayaran QRIS di meja sedang dalam perbaikan. Sementara ini mohon selesaikan pembayaran langsung di kasir."
                    : "Scan QRIS toko dan konfirmasi pembayaran langsung dari meja."}
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Bagian 3: Ringkasan Rincian Harga */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <ReceiptText className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-extrabold text-slate-900">
              Ringkasan Pembayaran
            </h2>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal ({totalItems} item)</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {formatRupiah(totals.subtotal)}
              </span>
            </div>

            {totals.serviceAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Service Charge ({totals.serviceRate}%)</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatRupiah(totals.serviceAmount)}
                </span>
              </div>
            )}

            {totals.taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  Pajak ({totals.taxRate}%
                  {totals.priceIncludesTax ? " termasuk" : ""})
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatRupiah(totals.taxAmount)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-base font-extrabold text-slate-900">
              <span>Total Bayar di Kasir</span>
              <span className="text-lg text-[#00884A] tabular-nums">
                {formatRupiah(totals.total)}
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer CTA Kirim Pesanan */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            disabled={isPending || cart.length === 0}
            onClick={onSubmitOrder}
            className="flex h-12 sm:h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#00884A] hover:bg-[#00733E] disabled:opacity-60 px-5 text-sm sm:text-base font-extrabold text-white shadow-[0_8px_20px_rgba(0,136,74,0.28)] active:scale-[0.99] transition cursor-pointer"
          >
            <span>
              {isPending
                ? "Mengirim Pesanan..."
                : `Kirim Pesanan & Bayar di Kasir \u2022 ${formatRupiah(totals.total)}`}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}
