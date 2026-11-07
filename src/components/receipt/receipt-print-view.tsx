"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [printCount, setPrintCount] = useState(0);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6 print:max-w-none print:p-0">
      {/* Toolbar (Disembunyikan saat print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm print:hidden">
        <Link href="/kasir">
          <Button type="button" variant="outline" size="sm">
            ← Kembali ke Kasir
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
            🖨️ {printCount > 0 ? "Cetak Ulang Struk" : "Cetak Struk"}
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
        {/* Header Outlet */}
        <div className="border-b border-dashed border-zinc-400 pb-2.5 text-center">
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
                {receipt.discountReason ? ` (${receipt.discountReason})` : ""}
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
              *** DIBATALKAN / REFUND {formatRupiah(receipt.refund.amount)} ***
            </p>
            <p>Alasan: {receipt.refund.reason}</p>
          </div>
        )}

        {/* Footer Struk */}
        <div className="pt-2.5 text-center text-[10px] leading-relaxed text-zinc-700">
          <p>
            {receipt.receiptFooter ??
              "Terima kasih atas kunjungan Anda di Kafe Nusantara 1621!"}
          </p>
        </div>
      </div>
    </div>
  );
}
