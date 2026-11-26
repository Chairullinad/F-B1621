"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
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
  OrderVoidRecordView,
  TransactionRowView,
  TransactionsDashboardData,
} from "@/server/manual-order-and-transactions";

function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

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
  const [activeTab, setActiveTab] = useState<"transactions" | "voids">(
    "transactions"
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [voidScopeFilter, setVoidScopeFilter] = useState<
    "all" | "full_order" | "partial_item"
  >("all");
  const [voidSearchQuery, setVoidSearchQuery] = useState<string>("");
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

  const filteredVoidRecords = useMemo(() => {
    const q = voidSearchQuery.trim().toLowerCase();
    return initialData.voidRecords.filter((rec) => {
      if (voidScopeFilter !== "all" && rec.voidScope !== voidScopeFilter) {
        return false;
      }
      if (
        q &&
        !rec.orderNo.toLowerCase().includes(q) &&
        !rec.tableName.toLowerCase().includes(q) &&
        !rec.productName.toLowerCase().includes(q) &&
        !rec.reason.toLowerCase().includes(q) &&
        !rec.actorName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [initialData.voidRecords, voidScopeFilter, voidSearchQuery]);

  const voidMetrics = useMemo(() => {
    let fullOrderCount = 0;
    let partialItemCount = 0;
    let totalVoidAmount = 0;
    for (const rec of filteredVoidRecords) {
      if (rec.voidScope === "full_order") {
        fullOrderCount += 1;
      } else {
        partialItemCount += 1;
      }
      totalVoidAmount += rec.voidAmount;
    }
    return { fullOrderCount, partialItemCount, totalVoidAmount };
  }, [filteredVoidRecords]);

  function handleExportVoidCsv() {
    const headers = [
      "Waktu (WIB)",
      "Outlet",
      "No Order",
      "Meja",
      "Jenis",
      "Status Saat Void",
      "Menu / Item",
      "Qty Awal",
      "Qty Akhir",
      "Qty Dibatalkan",
      "Nominal Batal (Rp)",
      "Kategori Alasan",
      "Alasan",
      "Pelaku",
    ];
    const rows = filteredVoidRecords.map((rec: OrderVoidRecordView) => [
      formatDateTimeWIB(rec.createdAt),
      rec.outletName,
      `#${rec.orderNo}`,
      rec.tableName,
      rec.voidScope === "full_order" ? "Batal Pesanan" : "Batal Item",
      rec.orderStatusAtVoid.toUpperCase(),
      rec.productName,
      rec.qtyBefore,
      rec.qtyAfter,
      rec.qtyCancelled,
      rec.voidAmount,
      rec.reasonCategory === "outlet_fault" ? "Kesalahan Outlet" : "Lainnya",
      rec.reason,
      rec.actorName,
    ]);
    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((cols) => cols.map(escapeCsvCell).join(","))
        .join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pembatalan-void-${activePeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

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
              aria-label="Filter Outlet Transaksi"
              value={initialData.selectedOutletId}
              onChange={(e) => {
                const params = new URLSearchParams({
                  period: activePeriod,
                  outletId: e.target.value,
                });
                if (initialData.activeStartDate && initialData.activeEndDate) {
                  params.set("startDate", initialData.activeStartDate);
                  params.set("endDate", initialData.activeEndDate);
                }
                router.push(`/dashboard/transaksi?${params.toString()}`);
              }}
              className="h-11 rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-zinc-800 dark:text-slate-100"
            >
              <option value="ALL">Semua Outlet (Konsolidasi)</option>
              {initialData.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  Outlet: {o.name}
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
                  variant={
                    !initialData.isCustomRange && activePeriod === p.key
                      ? "default"
                      : "outline"
                  }
                >
                  {p.label}
                </Button>
              </Link>
            ))}
          </div>

          <DateRangeFilter
            startDate={initialData.activeStartDate ?? ""}
            endDate={initialData.activeEndDate ?? ""}
            hasActiveCustomRange={initialData.isCustomRange}
            onApply={({ startDate, endDate }) => {
              const params = new URLSearchParams({
                period: activePeriod,
                startDate,
                endDate,
              });
              if (initialData.staff.role === "owner") {
                params.set("outletId", initialData.selectedOutletId);
              }
              router.push(`/dashboard/transaksi?${params.toString()}`);
            }}
            onReset={() => {
              const params = new URLSearchParams({ period: activePeriod });
              if (initialData.staff.role === "owner") {
                params.set("outletId", initialData.selectedOutletId);
              }
              router.push(`/dashboard/transaksi?${params.toString()}`);
            }}
          />
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

      {/* Tab Navigasi Utama: Riwayat Transaksi vs Tabel Pembatalan & Void Item */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
        <button
          type="button"
          onClick={() => setActiveTab("transactions")}
          className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "transactions"
              ? "bg-slate-900 text-white dark:bg-sky-600"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Riwayat Transaksi ({filteredList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("voids")}
          className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "voids"
              ? "bg-red-600 text-white dark:bg-red-700"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <span>Tabel Pembatalan &amp; Void Item</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "voids"
                ? "bg-white/20 text-white"
                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {initialData.voidRecords.length}
          </span>
        </button>
      </div>

      {activeTab === "transactions" ? (
        <>
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
        </>
      ) : (
        <div className="space-y-4">
          {!initialData.voidTableReady && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-bold">
                Tabel <code>order_void_records</code> belum dibuat di database.
              </p>
              <p className="mt-1">
                Saat ini tampilan menampilkan fallback pembatalan pesanan penuh dari data transaksi. Jalankan migrasi{" "}
                <code>supabase/migrations/20261107000014_order_void_records.sql</code> di Supabase SQL Editor agar catatan void per item (<code>partial_item</code>) ikut tersimpan permanen.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pembatalan Pesanan Penuh</CardDescription>
                <CardTitle className="text-xl font-extrabold text-red-600 dark:text-red-400">
                  {voidMetrics.fullOrderCount} Pesanan
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Void / Kurangi Item</CardDescription>
                <CardTitle className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {voidMetrics.partialItemCount} Kejadian
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Nominal Batal &amp; Void</CardDescription>
                <CardTitle className="text-xl font-extrabold text-zinc-900 dark:text-slate-100">
                  {formatRupiah(voidMetrics.totalVoidAmount)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <select
              aria-label="Filter Jenis Pembatalan"
              value={voidScopeFilter}
              onChange={(e) =>
                setVoidScopeFilter(
                  e.target.value as "all" | "full_order" | "partial_item"
                )
              }
              className="h-11 rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-zinc-900 dark:text-slate-100"
            >
              <option value="all">
                Semua Jenis ({initialData.voidRecords.length})
              </option>
              <option value="full_order">Batal Pesanan (Full Order)</option>
              <option value="partial_item">Batal / Kurangi Item (Void Item)</option>
            </select>

            <Input
              type="search"
              placeholder="Cari no. order, meja, menu, alasan, atau staf..."
              value={voidSearchQuery}
              onChange={(e) => setVoidSearchQuery(e.target.value)}
              className="flex-1 min-w-52"
            />

            <Button
              type="button"
              variant="outline"
              disabled={filteredVoidRecords.length === 0}
              onClick={handleExportVoidCsv}
              className="min-h-[44px]"
            >
              Export CSV Pembatalan
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredVoidRecords.length === 0 ? (
                <div className="py-14 text-center text-sm text-zinc-500 dark:text-slate-400">
                  Belum ada data pembatalan pesanan maupun void item pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-800/80 text-xs uppercase text-zinc-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Waktu (WIB)</th>
                        <th className="px-4 py-3">Order &amp; Meja</th>
                        <th className="px-4 py-3">Jenis</th>
                        <th className="px-4 py-3">Item &amp; Perubahan Qty</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                        <th className="px-4 py-3">Alasan &amp; Pelaku</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-slate-800">
                      {filteredVoidRecords.map((rec) => (
                        <tr
                          key={rec.id}
                          className="hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-600 dark:text-slate-300">
                            {formatDateTimeWIB(rec.createdAt)}
                            {initialData.selectedOutletId === "ALL" && (
                              <div className="mt-0.5 font-semibold text-[#1E88E5] dark:text-sky-400">
                                {rec.outletName}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-zinc-900 dark:text-slate-100">
                              #{rec.orderNo}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-slate-400">
                              {rec.tableName}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTxId(rec.orderId);
                                setActiveTab("transactions");
                              }}
                              className="mt-1 text-xs font-semibold text-[#1E88E5] hover:underline dark:text-sky-400"
                            >
                              Lihat Order &rarr;
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                rec.voidScope === "full_order"
                                  ? "destructive"
                                  : "warning"
                              }
                            >
                              {rec.voidScope === "full_order"
                                ? "BATAL PESANAN"
                                : "VOID ITEM"}
                            </Badge>
                            <div className="mt-1 text-[11px] uppercase text-zinc-500 dark:text-slate-400">
                              Status awal: {rec.orderStatusAtVoid}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-semibold text-zinc-900 dark:text-slate-100">
                              {rec.productName}
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-slate-400">
                              {rec.voidScope === "partial_item"
                                ? `Qty: ${rec.qtyBefore} → ${rec.qtyAfter} (Dibatalkan: ${rec.qtyCancelled})`
                                : `Total item dibatalkan: ${rec.qtyCancelled}`}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-extrabold text-red-600 dark:text-red-400">
                            {formatRupiah(rec.voidAmount)}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="text-xs font-medium text-zinc-800 dark:text-slate-200">
                              &ldquo;{rec.reason}&rdquo;
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-slate-400">
                              {rec.reasonCategory === "outlet_fault"
                                ? "Kesalahan Outlet"
                                : "Lainnya"}{" "}
                              • Oleh: {rec.actorName}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
