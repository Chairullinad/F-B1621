"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChefHat, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTimeWIB } from "@/lib/datetime";
import { formatRupiah } from "@/lib/money";
import {
  recordReceiptReprintAction,
  type OrderReceiptDetail,
} from "@/server/cashier";

export function ReceiptPrintView({
  receipt,
}: {
  receipt: OrderReceiptDetail;
}) {
  const [paperSize, setPaperSize] = useState<"58mm" | "80mm">("80mm");
  const [printMode, setPrintMode] = useState<"both" | "customer" | "kitchen">(
    "both"
  );
  const [printCount, setPrintCount] = useState(0);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "kitchen" || modeParam === "customer") {
      setPrintMode(modeParam);
    }
    if (params.get("autoprint") === "1") {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  async function handlePrint() {
    try {
      const res = await recordReceiptReprintAction({
        orderId: receipt.orderId,
      });
      if (res.ok) {
        setPrintCount((c) => c + 1);
        setAuditNotice(res.message);
      }
    } finally {
      window.print();
    }
  }

  const totalQty = receipt.items.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6 print:max-w-none print:p-0">
      {/* Toolbar (Disembunyikan saat print) */}
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/kasir">
            <Button type="button" variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Kembali ke Kasir
            </Button>
          </Link>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={paperSize === "58mm" ? "default" : "outline"}
              onClick={() => setPaperSize("58mm")}
            >
              58mm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={paperSize === "80mm" ? "default" : "outline"}
              onClick={() => setPaperSize("80mm")}
            >
              80mm
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              {printCount > 0 ? "Cetak Ulang" : "Cetak Sekarang"}
            </Button>
          </div>
        </div>

        {/* Pilihan Mode Slip Cetak: Struk Harga + Struk Antrean Kitchen */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
          <span className="mr-1 text-xs font-semibold text-slate-500">
            Bagian Cetak:
          </span>
          <Button
            type="button"
            size="sm"
            variant={printMode === "both" ? "default" : "outline"}
            onClick={() => setPrintMode("both")}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Struk Harga + Antrean Kitchen
          </Button>
          <Button
            type="button"
            size="sm"
            variant={printMode === "customer" ? "default" : "outline"}
            onClick={() => setPrintMode("customer")}
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Struk Harga Saja
          </Button>
          <Button
            type="button"
            size="sm"
            variant={printMode === "kitchen" ? "default" : "outline"}
            onClick={() => setPrintMode("kitchen")}
          >
            <ChefHat className="mr-1.5 h-3.5 w-3.5" />
            Tiket Kitchen Saja
          </Button>
        </div>
      </div>

      {auditNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 print:hidden">
          {auditNotice}
        </div>
      )}

      {/* Kertas Struk Thermal 58mm / 80mm */}
      <div
        className={`mx-auto rounded-xl border border-zinc-300 bg-white p-4 font-mono text-xs text-zinc-950 shadow-sm print:rounded-none print:border-none print:p-1 print:shadow-none ${
          paperSize === "58mm" ? "w-[220px]" : "w-[302px]"
        }`}
      >
        {/* ================================================================ */}
        {/* BAGIAN 1: STRUK RINCIAN HARGA PELANGGAN / KASIR                  */}
        {/* ================================================================ */}
        {(printMode === "both" || printMode === "customer") && (
          <div>
            {/* Header Outlet */}
            <div className="border-b border-dashed border-zinc-400 pb-2.5 text-center">
              <div className="mx-auto mb-1.5 flex h-14 w-28 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-1621group-stacked.png"
                  alt="Logo 1621 Group"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-sm font-bold uppercase tracking-wide">
                {receipt.outletName}
              </h1>
              {receipt.outletAddress && (
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-700">
                  {receipt.outletAddress}
                </p>
              )}
            </div>

            {/* Metadata Transaksi */}
            <div className="space-y-0.5 border-b border-dashed border-zinc-400 py-2 text-[11px]">
              <div className="flex justify-between">
                <span>No. Order:</span>
                <span className="font-bold">#{receipt.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>
                  {formatDateTimeWIB(receipt.paidAt ?? receipt.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{receipt.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Meja / Tipe:</span>
                <span className="font-bold">
                  {receipt.orderType === "takeaway"
                    ? "Takeaway / Bungkus"
                    : receipt.tableName}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="font-bold uppercase">
                  {receipt.paymentMethod === "qris" ? "QRIS" : "TUNAI"}
                </span>
              </div>
            </div>

            {/* Daftar Item */}
            <div className="space-y-1.5 border-b border-dashed border-zinc-400 py-2.5 text-[11px]">
              {receipt.items.map((item) => (
                <div key={item.id}>
                  <div className="font-semibold">{item.productName}</div>
                  <div className="flex justify-between">
                    <span>
                      {item.qty} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span>{formatRupiah(item.lineTotal)}</span>
                  </div>
                  {item.note && (
                    <div className="italic text-zinc-600">
                      * Catatan: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Rincian Angka */}
            <div className="space-y-1 border-b border-dashed border-zinc-400 py-2 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRupiah(receipt.subtotal)}</span>
              </div>

              {receipt.discount > 0 && (
                <div className="flex justify-between">
                  <span>
                    Diskon
                    {receipt.discountReason
                      ? ` (${receipt.discountReason})`
                      : ""}
                  </span>
                  <span>- {formatRupiah(receipt.discount)}</span>
                </div>
              )}

              {receipt.serviceAmount > 0 && receipt.serviceRate !== null && (
                <div className="flex justify-between">
                  <span>Service ({receipt.serviceRate}%)</span>
                  <span>{formatRupiah(receipt.serviceAmount)}</span>
                </div>
              )}

              {receipt.taxAmount > 0 && receipt.taxRate !== null && (
                <div className="flex justify-between">
                  <span>
                    Pajak ({receipt.taxRate}%
                    {receipt.priceIncludesTax ? " Termasuk" : ""})
                  </span>
                  <span>{formatRupiah(receipt.taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-dashed border-zinc-300 pt-1 text-xs font-bold">
                <span>TOTAL</span>
                <span>{formatRupiah(receipt.total)}</span>
              </div>

              <div className="flex justify-between pt-0.5">
                <span>
                  Bayar ({receipt.paymentMethod === "qris" ? "QRIS" : "Tunai"})
                </span>
                <span>{formatRupiah(receipt.amountReceived)}</span>
              </div>

              <div className="flex justify-between font-semibold">
                <span>Kembali</span>
                <span>{formatRupiah(receipt.changeAmount)}</span>
              </div>
            </div>

            {/* Informasi Pembatalan / Refund jika ada */}
            {receipt.refund && (
              <div className="my-2 border border-zinc-900 p-1.5 text-center text-[10px]">
                <p className="font-bold uppercase">
                  *** DIBATALKAN / REFUND {formatRupiah(receipt.refund.amount)}{" "}
                  ***
                </p>
                <p>Alasan: {receipt.refund.reason}</p>
              </div>
            )}

            {/* Footer Struk */}
            <div className="pt-2.5 text-center text-[10px] leading-relaxed text-zinc-700">
              <p>
                {receipt.receiptFooter ??
                  "Terima kasih atas kunjungan Anda di 1621 Group!"}
              </p>
            </div>
          </div>
        )}

        {/* GARIS POTONG ANTARA STRUK HARGA & STRUK KITCHEN */}
        {printMode === "both" && (
          <div className="my-4 border-y-2 border-dashed border-zinc-900 py-1.5 text-center text-[10px] font-bold tracking-widest uppercase">
            --- POTONG UNTUK KITCHEN ---
          </div>
        )}

        {/* ================================================================ */}
        {/* BAGIAN 2: STRUK ANTREAN KITCHEN (KITCHEN CHECKER / DOCKET)       */}
        {/* ================================================================ */}
        {(printMode === "both" || printMode === "kitchen") && (
          <div>
            <div className="border-b-2 border-zinc-900 pb-2 text-center">
              <p className="text-[11px] font-extrabold tracking-wider uppercase">
                *** TIKET ANTREAN KITCHEN ***
              </p>
              <p className="text-[10px] font-semibold uppercase text-zinc-700">
                {receipt.outletName}
              </p>
              <div className="mt-1.5 rounded border-2 border-zinc-900 px-2 py-1">
                <p className="text-base font-extrabold uppercase leading-tight">
                  {receipt.orderType === "takeaway"
                    ? "TAKEAWAY / BUNGKUS"
                    : receipt.tableName}
                </p>
                <p className="text-xs font-extrabold">
                  ANTREAN #{receipt.orderNo}
                </p>
              </div>
            </div>

            <div className="space-y-0.5 border-b border-dashed border-zinc-400 py-1.5 text-[10px]">
              <div className="flex justify-between">
                <span>Jam Masuk Kitchen:</span>
                <span className="font-bold">
                  {formatDateTimeWIB(receipt.paidAt ?? receipt.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{receipt.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Porsi:</span>
                <span className="font-bold">{totalQty} item</span>
              </div>
            </div>

            {/* Daftar Menu Produksi Kitchen (Tanpa Harga, Huruf Besar + Kotak Checker) */}
            <div className="space-y-2 border-b-2 border-zinc-900 py-2.5">
              {receipt.items.map((item) => (
                <div key={`kitchen-${item.id}`} className="text-xs">
                  <div className="flex items-start justify-between gap-2 font-extrabold">
                    <span>
                      [ ] {item.qty}x {item.productName}
                    </span>
                  </div>
                  {item.note && (
                    <div className="mt-0.5 border-l-2 border-zinc-900 pl-2 text-[11px] font-bold">
                      CATATAN KITCHEN: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 text-center text-[10px] font-bold uppercase">
              <p>CEK KESESUAIAN PESANAN SEBELUM DIANTAR KE MEJA</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
