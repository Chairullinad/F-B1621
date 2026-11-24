"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTimeWIB } from "@/lib/datetime";
import { formatRupiah } from "@/lib/money";
import type { OrderStatus, RefundReasonCategory } from "@/lib/types/database";
import { cancelOrderWithRefundAction } from "@/server/cashier";
import type {
  TransactionRowView,
  TransactionsDashboardData,
} from "@/server/manual-order-and-transactions";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "MENUNGGU BAYAR",
  paid: "DIBAYAR",
  ready: "SIAP ANTAR",
  served: "SELESAI (SERVED)",
  cancelled: "DIBATALKAN",
  expired: "KEDALUWARSA",
};

const STATUS_VARIANTS: Record<
  OrderStatus,
  "default" | "secondary" | "warning" | "success" | "destructive" | "outline"
> = {
  pending: "warning",
  paid: "default",
  ready: "success",
  served: "secondary",
  cancelled: "destructive",
  expired: "outline",
};

export function TransactionsHistoryView({
  initialData,
  activePeriod,
}: {
  initialData: TransactionsDashboardData;
  activePeriod: "today" | "7d" | "30d" | "all";
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(
    initialData.transactions[0]?.id ?? null
  );

  // State modal pembatalan & refund
  const [cancelCategory, setCancelCategory] =
    useState<RefundReasonCategory>("outlet_fault");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialData.transactions.filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) {
        return false;
      }
      if (cashierFilter !== "all" && tx.cashierId !== cashierFilter) {
        return false;
      }
      if (
        q &&
        !tx.orderNo.toLowerCase().includes(q) &&
        !tx.tableName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [initialData.transactions, statusFilter, cashierFilter, searchQuery]);

  const selectedTx: TransactionRowView | null = useMemo(() => {
    if (!selectedTxId) return filteredList[0] ?? null;
    return (
      filteredList.find((t) => t.id === selectedTxId) ??
      filteredList[0] ??
      null
    );
  }, [filteredList, selectedTxId]);

  async function handleCancelAndRefund() {
    if (!selectedTx) return;
    setIsCancelling(true);
    setFeedback(null);
    try {
      const res = await cancelOrderWithRefundAction({
        orderId: selectedTx.id,
        expectedVersion: selectedTx.version,
        reasonCategory: cancelCategory,
        reason: cancelReason,
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      if (res.ok) {
        setCancelReason("");
        router.refresh();
      }
    } finally {
      setIsCancelling(false);
    }
  }

  const { summary } = initialData;

  return (
    <div className="space-y-4">
      {/* Pilihan Periode Waktu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-extrabold text-zinc-900 dark:text-slate-100">
              Riwayat Transaksi &amp; Ringkasan Penjualan ({summary.periodLabel})
            </h1>
            <span className="inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E88E5] dark:text-sky-300">
              {initialData.scopeLabel}
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
            Rekapitulasi penjualan kotor, diskon, refund, dan penjualan bersih
            serta daftar transaksi lengkap.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {initialData.isHoldingMode && (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-zinc-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-slate-800"
            >
              &larr; Dashboard Owner
            </Link>
          )}
          {initialData.staff.role === "owner" && initialData.outlets.length > 0 && (
            <select
              aria-label="Filter Kios Transaksi"
              value={initialData.selectedOutletId}
              onChange={(e) =>
                router.push(
                  `/dashboard/transaksi?period=${activePeriod}&outletId=${encodeURIComponent(e.target.value)}`
                )
              }
              className="h-11 rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-zinc-800 dark:text-slate-100"
            >
              <option value="ALL">Semua Usaha / Kios (Konsolidasi)</option>
              {initialData.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  Kios: {o.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "today", label: "Hari Ini (WIB)" },
                { key: "7d", label: "7 Hari Terakhir" },
                { key: "30d", label: "30 Hari Terakhir" },
                { key: "all", label: "Semua Periode" },
              ] as const
            ).map((p) => (
              <Link
                key={p.key}
                href={`/dashboard/transaksi?period=${p.key}${
                  initialData.staff.role === "owner"
                    ? `&outletId=${encodeURIComponent(initialData.selectedOutletId)}`
                    : ""
                }`}
              >
                <Button
                  type="button"
                  size="sm"
                  variant={activePeriod === p.key ? "default" : "outline"}
                >
                  {p.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Kartu Ringkasan Penjualan (Kotor, Refund, Bersih) sesuai PRD 5.6 & 5.10 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Penjualan Kotor (Gross Sales)</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-zinc-900 dark:text-slate-100">
              {formatRupiah(summary.grossSales)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-slate-400">
            {summary.paidOrdersCount} transaksi dibayar (Tunai:{" "}
            {formatRupiah(summary.cashGrossSales)} • QRIS:{" "}
            {formatRupiah(summary.qrisGrossSales)})
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Diskon Diberikan</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">
              {formatRupiah(summary.totalDiscount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-slate-400">
            Potongan harga yang sudah disetujui pada order lunas
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Refund (Pembatalan)</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-red-600 dark:text-red-400">
              - {formatRupiah(summary.totalRefund)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-slate-400">
            {summary.cancelledOrdersCount} order dibatalkan pada periode ini
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-600 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30">
          <CardHeader className="pb-2">
            <CardDescription className="font-semibold text-emerald-900 dark:text-emerald-300">
              Penjualan Bersih (Net Sales)
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">
              {formatRupiah(summary.netSales)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
            Penjualan Kotor dikurangi Total Refund
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          }`}
        >
          <span>{feedback.text}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFeedback(null)}
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Baris Filter Status, Kasir, dan Pencarian */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
        <select
          aria-label="Filter Status Order"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-zinc-900 dark:text-slate-100"
        >
          <option value="all">Semua Status ({initialData.transactions.length})</option>
          <option value="paid">DIBAYAR (PAID)</option>
          <option value="ready">SIAP ANTAR (READY)</option>
          <option value="served">SELESAI (SERVED)</option>
          <option value="cancelled">DIBATALKAN (CANCELLED)</option>
          <option value="pending">MENUNGGU BAYAR (PENDING)</option>
          <option value="expired">KEDALUWARSA (EXPIRED)</option>
        </select>

        <select
          aria-label="Filter Kasir"
          value={cashierFilter}
          onChange={(e) => setCashierFilter(e.target.value)}
          className="h-11 rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-zinc-900 dark:text-slate-100"
        >
          <option value="all">Semua Kasir / Staf</option>
          {initialData.cashiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName} ({c.role.toUpperCase()})
            </option>
          ))}
        </select>

        <Input
          type="search"
          placeholder="Cari nomor order atau meja..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-52"
        />
      </div>

      {/* Grid Tabel Transaksi (Kiri) & Detail Transaksi + Cetak Ulang + Refund (Kanan) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card>
            <CardContent className="p-0">
              {filteredList.length === 0 ? (
                <div className="py-14 text-center text-sm text-zinc-500 dark:text-slate-400">
                  Tidak ada transaksi yang cocok dengan filter saat ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-800/80 text-xs uppercase text-zinc-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Order &amp; Waktu</th>
                        <th className="px-4 py-3">Meja / Kasir</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-slate-800">
                      {filteredList.map((tx) => {
                        const isSelected = selectedTx?.id === tx.id;
                        return (
                          <tr
                            key={tx.id}
                            onClick={() => setSelectedTxId(tx.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-zinc-100 font-medium dark:bg-slate-800"
                                : "hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-mono font-bold text-zinc-900 dark:text-slate-100">
                                #{tx.orderNo}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-slate-400">
                                {formatDateTimeWIB(tx.createdAt)}
                              </div>
                              {initialData.selectedOutletId === "ALL" && (
                                <div className="mt-0.5 text-[11px] font-semibold text-[#1E88E5] dark:text-sky-400">
                                  {tx.outletName}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-zinc-900 dark:text-slate-100">
                                {tx.tableName}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-slate-400">
                                Kasir: {tx.cashierName}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={STATUS_VARIANTS[tx.status]}>
                                {STATUS_LABELS[tx.status]}
                              </Badge>
                              {tx.refund && (
                                <div className="mt-1 text-[11px] font-bold text-red-600">
                                  Refund: {formatRupiah(tx.refund.amount)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-extrabold text-zinc-900 dark:text-slate-100">
                                {formatRupiah(tx.total)}
                              </div>
                              {tx.paymentMethod && (
                                <div className="text-xs uppercase text-zinc-500 dark:text-slate-400">
                                  {tx.paymentMethod === "qris"
                                    ? "QRIS"
                                    : "Tunai"}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Transaksi & Cetak Ulang Struk */}
        <div className="lg:col-span-5">
          {!selectedTx ? (
            <Card>
              <CardContent className="py-14 text-center text-sm text-zinc-500 dark:text-slate-400">
                Pilih satu baris transaksi untuk melihat rincian lengkap.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-zinc-100 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      Order #{selectedTx.orderNo} ({selectedTx.tableName})
                    </CardTitle>
                    <CardDescription>
                      Waktu: {formatDateTimeWIB(selectedTx.createdAt)} • Kasir:{" "}
                      {selectedTx.cashierName}
                    </CardDescription>
                  </div>
                  {selectedTx.status !== "pending" &&
                    selectedTx.status !== "expired" && (
                      <Link href={`/struk/${selectedTx.id}`}>
                        <Button type="button" size="sm">
                          🖨️ Cetak Ulang Struk
                        </Button>
                      </Link>
                    )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                <div className="divide-y divide-zinc-200 dark:divide-slate-800 rounded-xl border border-zinc-200 dark:border-slate-800 bg-zinc-50/60 dark:bg-slate-800/50 p-3 text-sm">
                  {selectedTx.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between py-1.5 first:pt-0 last:pb-0"
                    >
                      <div>
                        <span className="font-semibold">
                          {item.qty}x {item.productName}
                        </span>
                        {item.note && (
                          <p className="text-xs italic text-zinc-500 dark:text-slate-400">
                            Catatan: {item.note}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold">
                        {formatRupiah(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatRupiah(selectedTx.subtotal)}</span>
                  </div>
                  {selectedTx.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>
                        Diskon{" "}
                        {selectedTx.discountReason
                          ? `(${selectedTx.discountReason})`
                          : ""}
                      </span>
                      <span>- {formatRupiah(selectedTx.discount)}</span>
                    </div>
                  )}
                  {selectedTx.serviceAmount > 0 && (
                    <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                      <span>Service ({selectedTx.serviceRate ?? 0}%)</span>
                      <span>{formatRupiah(selectedTx.serviceAmount)}</span>
                    </div>
                  )}
                  {selectedTx.taxAmount > 0 && (
                    <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                      <span>Pajak ({selectedTx.taxRate ?? 0}%)</span>
                      <span>{formatRupiah(selectedTx.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-200 dark:border-slate-800 pt-2 text-base font-extrabold text-zinc-900 dark:text-slate-100">
                    <span>Total</span>
                    <span>{formatRupiah(selectedTx.total)}</span>
                  </div>
                </div>

                {selectedTx.refund && (
                  <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-950 dark:text-red-200">
                    <p className="font-bold">
                      Refund Tunai Tercatat:{" "}
                      {formatRupiah(selectedTx.refund.amount)}
                    </p>
                    <p className="mt-0.5">
                      Kategori:{" "}
                      {selectedTx.refund.reasonCategory === "outlet_fault"
                        ? "Kesalahan Outlet"
                        : "Lainnya"}{" "}
                      • Alasan: &ldquo;{selectedTx.refund.reason}&rdquo;
                    </p>
                  </div>
                )}

                {/* Form Pembatalan / Refund dari Riwayat Transaksi */}
                {selectedTx.status !== "cancelled" &&
                  selectedTx.status !== "expired" && (
                    <div className="space-y-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/30 p-3.5">
                      <p className="text-xs font-bold text-red-950 dark:text-red-200">
                        Batalkan Order &amp; Catat Refund
                      </p>
                      {selectedTx.status === "served" &&
                      initialData.staff.role !== "owner" ? (
                        <p className="text-xs text-red-800 dark:text-red-300">
                          Order ini sudah berstatus <strong>SERVED</strong>.
                          Sesuai aturan bisnis, hanya <strong>Owner</strong>{" "}
                          yang dapat membatalkan order yang sudah disajikan
                          (khusus kesalahan outlet).
                        </p>
                      ) : (
                        <>
                          <select
                            aria-label="Kategori Alasan Pembatalan"
                            value={cancelCategory}
                            onChange={(e) =>
                              setCancelCategory(
                                e.target.value as RefundReasonCategory
                              )
                            }
                            className="h-11 w-full rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                          >
                            <option value="outlet_fault">
                              Kesalahan Outlet (Salah menu / bahan bermasalah)
                            </option>
                            {selectedTx.status !== "served" && (
                              <option value="other">Alasan Lainnya</option>
                            )}
                          </select>
                          <Input
                            type="text"
                            placeholder="Alasan pembatalan wajib diisi..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={
                              isCancelling || cancelReason.trim().length < 3
                            }
                            onClick={handleCancelAndRefund}
                            className="w-full"
                          >
                            {isCancelling
                              ? "Memproses..."
                              : `Batalkan Order #${selectedTx.orderNo}`}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
