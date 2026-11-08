"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  History,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
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
import { formatDateTimeWIB, formatTimeWIB } from "@/lib/datetime";
import { formatRupiah } from "@/lib/money";
import {
  getShiftClosingPreviewAction,
  saveShiftClosingReportAction,
  type SavedShiftClosingReport,
  type ShiftClosingWorkspaceData,
  type ShiftExpenseItem,
  type ShiftTransactionMetrics,
} from "@/server/cashier-shift";

function toLocalDatetimeInputWIB(isoString: string): string {
  const d = new Date(isoString);
  const wibMs = d.getTime() + 7 * 60 * 60 * 1000;
  const wib = new Date(wibMs);
  return wib.toISOString().slice(0, 16);
}

function fromLocalDatetimeInputWIB(localValue: string): string {
  if (!localValue) return new Date().toISOString();
  return new Date(`${localValue}:00+07:00`).toISOString();
}

export function ShiftClosingManager({
  initialData,
}: {
  initialData: ShiftClosingWorkspaceData;
}) {
  const [shiftInCashierName, setShiftInCashierName] = React.useState(
    initialData.staff.fullName
  );
  const [shiftOutCashierName, setShiftOutCashierName] = React.useState(
    initialData.staffNames.find((n) => n !== initialData.staff.fullName) ??
      initialData.staff.fullName
  );

  const [shiftStartLocal, setShiftStartLocal] = React.useState(() =>
    toLocalDatetimeInputWIB(initialData.currentMetrics.shiftStartIso)
  );
  const [shiftEndLocal, setShiftEndLocal] = React.useState(() =>
    toLocalDatetimeInputWIB(initialData.currentMetrics.shiftEndIso)
  );

  const [metrics, setMetrics] = React.useState<ShiftTransactionMetrics>(
    initialData.currentMetrics
  );
  const [recentReports, setRecentReports] = React.useState<
    SavedShiftClosingReport[]
  >(initialData.recentReports);
  const [activeReportNo, setActiveReportNo] = React.useState<string>("DRAFT");

  const [openingCashInput, setOpeningCashInput] =
    React.useState<string>("200000");
  const [actualClosingCashInput, setActualClosingCashInput] =
    React.useState<string>("");
  const [closingNotes, setClosingNotes] = React.useState<string>(
    "Laci kasir, tablet POS, dan area kasir diserahkan dalam kondisi baik."
  );

  // Daftar pengeluaran shift (contoh: Es Batu, Sayur, dll.)
  const [expenses, setExpenses] = React.useState<ShiftExpenseItem[]>([]);
  const [newExpName, setNewExpName] = React.useState<string>("");
  const [newExpQty, setNewExpQty] = React.useState<string>("");
  const [newExpAmount, setNewExpAmount] = React.useState<string>("");

  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const openingCash = React.useMemo(() => {
    const clean = openingCashInput.replace(/[^\d]/g, "");
    return clean ? Number.parseInt(clean, 10) : 0;
  }, [openingCashInput]);

  const totalExpenses = React.useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  );

  const expectedClosingCash = React.useMemo(
    () =>
      openingCash +
      metrics.cashRevenue -
      metrics.cashRefundTotal -
      totalExpenses,
    [openingCash, metrics.cashRevenue, metrics.cashRefundTotal, totalExpenses]
  );

  const actualClosingCash = React.useMemo(() => {
    const clean = actualClosingCashInput.replace(/[^\d]/g, "");
    if (!clean) return expectedClosingCash;
    return Number.parseInt(clean, 10);
  }, [actualClosingCashInput, expectedClosingCash]);

  const cashDifference = actualClosingCash - expectedClosingCash;

  async function handleRefreshMetrics(
    customStartLocal?: string,
    customEndLocal?: string
  ) {
    const startIso = fromLocalDatetimeInputWIB(
      customStartLocal ?? shiftStartLocal
    );
    const endIso = fromLocalDatetimeInputWIB(customEndLocal ?? shiftEndLocal);
    setIsLoadingMetrics(true);
    try {
      const res = await getShiftClosingPreviewAction({
        shiftStartIso: startIso,
        shiftEndIso: endIso,
      });
      if (!res.ok || !res.metrics) {
        toast.error(res.message);
        return;
      }
      setMetrics(res.metrics);
      setActiveReportNo("DRAFT");
      toast.success("Data transaksi shift berhasil diperbarui.");
    } finally {
      setIsLoadingMetrics(false);
    }
  }

  function handleApplyShiftPreset(preset: "today" | "morning" | "evening") {
    const now = new Date();
    const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
    const wibDateStr = new Date(wibMs).toISOString().slice(0, 10);
    const nowLocalStr = new Date(wibMs).toISOString().slice(0, 16);

    let startStr = `${wibDateStr}T00:00`;
    let endStr = nowLocalStr;

    if (preset === "morning") {
      startStr = `${wibDateStr}T07:00`;
      endStr = `${wibDateStr}T15:00`;
    } else if (preset === "evening") {
      startStr = `${wibDateStr}T15:00`;
      endStr = nowLocalStr;
    }

    setShiftStartLocal(startStr);
    setShiftEndLocal(endStr);
    void handleRefreshMetrics(startStr, endStr);
  }

  function handleAddExpense() {
    const name = newExpName.trim();
    const qty = newExpQty.trim() || "1 pcs";
    const amt = Number.parseInt(newExpAmount.replace(/[^\d]/g, ""), 10) || 0;

    if (!name) {
      toast.error(
        "Masukkan nama pengeluaran terlebih dahulu (contoh: Es Batu, Sayur)."
      );
      return;
    }
    if (amt <= 0) {
      toast.error("Masukkan nominal pengeluaran Rupiah yang valid (> Rp 0).");
      return;
    }

    setExpenses((prev) => [
      ...prev,
      {
        id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        itemName: name,
        qtyLabel: qty,
        amount: amt,
      },
    ]);
    setNewExpName("");
    setNewExpQty("");
    setNewExpAmount("");
  }

  function handleRemoveExpense(id: string) {
    setExpenses((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSaveAndPrint(shouldPrint: boolean) {
    if (!shiftInCashierName.trim() || !shiftOutCashierName.trim()) {
      toast.error("Nama Kasir Shift In dan Shift Out wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveShiftClosingReportAction({
        shiftInCashierName: shiftInCashierName.trim(),
        shiftOutCashierName: shiftOutCashierName.trim(),
        shiftStartIso: metrics.shiftStartIso,
        shiftEndIso: metrics.shiftEndIso,
        openingCash,
        actualClosingCash,
        closingNotes: closingNotes.trim(),
        expenses,
      });

      if (!res.ok || !res.report) {
        toast.error(res.message);
        return;
      }

      setActiveReportNo(res.report.reportNo);
      setMetrics(res.report.metrics);
      setRecentReports((prev) => [res.report!, ...prev.slice(0, 14)]);
      toast.success(res.message);

      if (shouldPrint) {
        setTimeout(() => {
          window.print();
        }, 250);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleLoadSavedReport(report: SavedShiftClosingReport) {
    setShiftInCashierName(report.shiftInCashierName);
    setShiftOutCashierName(report.shiftOutCashierName);
    setShiftStartLocal(toLocalDatetimeInputWIB(report.shiftStartIso));
    setShiftEndLocal(toLocalDatetimeInputWIB(report.shiftEndIso));
    setOpeningCashInput(String(report.openingCash));
    setActualClosingCashInput(String(report.actualClosingCash));
    setClosingNotes(report.closingNotes);
    setExpenses(report.expenses);
    setMetrics(report.metrics);
    setActiveReportNo(report.reportNo);
    toast.info(`Laporan #${report.reportNo} dimuat ke pratinjau struk.`);
  }

  return (
    <div className="space-y-6">
      {/* CSS Khusus Cetak agar Saat Klik Print Hanya Struk Tutupan Shift yang Tercetak */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #shift-closing-printable,
          #shift-closing-printable * {
            visibility: visible !important;
          }
          #shift-closing-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 print:block">
        {/* KOLOM KIRI: FORM INPUT TUTUPAN SHIFT & PENGELUARAN (DISEMBUNYIKAN SAAT PRINT) */}
        <div className="space-y-4 lg:col-span-7 print:hidden">
          {/* 1. IDENTITAS PETUGAS SHIFT IN / SHIFT OUT & RENTANG WAKTU */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="h-5 w-5 text-[#1B5E86]" />
                    1. Petugas Kasir Shift In &amp; Shift Out
                  </CardTitle>
                  <CardDescription>
                    Atur nama kasir yang menyerahkan shift (Shift In), kasir
                    penerima/penutup (Shift Out), dan rentang jam shift.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono">
                  #{activeReportNo}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama Kasir Shift In (Pembuka Shift)
                  </label>
                  <Input
                    value={shiftInCashierName}
                    onChange={(e) => setShiftInCashierName(e.target.value)}
                    placeholder="Nama kasir shift in..."
                  />
                  {initialData.staffNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {initialData.staffNames.map((n) => (
                        <button
                          key={`in-${n}`}
                          type="button"
                          onClick={() => setShiftInCashierName(n)}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama Kasir Shift Out (Penutup / Penerima Shift)
                  </label>
                  <Input
                    value={shiftOutCashierName}
                    onChange={(e) => setShiftOutCashierName(e.target.value)}
                    placeholder="Nama kasir shift out..."
                  />
                  {initialData.staffNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {initialData.staffNames.map((n) => (
                        <button
                          key={`out-${n}`}
                          type="button"
                          onClick={() => setShiftOutCashierName(n)}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pilih Cepat Jam Shift */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    Rentang Waktu Shift (WIB)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyShiftPreset("today")}
                    >
                      Hari Ini Penuh
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyShiftPreset("morning")}
                    >
                      Shift Pagi (07:00-15:00)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyShiftPreset("evening")}
                    >
                      Shift Sore/Malam (15:00-Kini)
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Waktu Shift In (Mulai)
                    </label>
                    <Input
                      type="datetime-local"
                      value={shiftStartLocal}
                      onChange={(e) => setShiftStartLocal(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Waktu Shift Out (Selesai)
                    </label>
                    <Input
                      type="datetime-local"
                      value={shiftEndLocal}
                      onChange={(e) => setShiftEndLocal(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isLoadingMetrics}
                      onClick={() => void handleRefreshMetrics()}
                      className="w-full"
                    >
                      <RefreshCw
                        className={`mr-1.5 h-4 w-4 ${
                          isLoadingMetrics ? "animate-spin" : ""
                        }`}
                      />
                      {isLoadingMetrics ? "Memuat..." : "Tarik Data Shift"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. PENGELUARAN OPERASIONAL SHIFT (ES BATU, SAYUR, DLL.) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5 text-[#1B5E86]" />
                    2. Pengeluaran Kas di Shift Ini (Es Batu, Sayur, dll.)
                  </CardTitle>
                  <CardDescription>
                    Catat belanja mendadak dari laci kasir selama shift
                    berlangsung. Otomatis memotong kas akhir ekspektasi.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  Total: {formatRupiah(totalExpenses)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Preset Cepat Pengeluaran */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Isi Cepat:
                </span>
                {[
                  { name: "Es Batu", qty: "3 bar", amount: "30000" },
                  { name: "Sayur Segar", qty: "2 ikat", amount: "20000" },
                  { name: "Air Galon", qty: "2 galon", amount: "40000" },
                  { name: "Gas LPG 3kg", qty: "1 tabung", amount: "22000" },
                  { name: "Plastik / Kemasan", qty: "1 pack", amount: "15000" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setNewExpName(preset.name);
                      setNewExpQty(preset.qty);
                      setNewExpAmount(preset.amount);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    + {preset.name} ({preset.qty})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <Input
                    placeholder="Nama barang (cth: Es Batu, Sayur)"
                    value={newExpName}
                    onChange={(e) => setNewExpName(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Jml (cth: 3 bar / 2 kg)"
                    value={newExpQty}
                    onChange={(e) => setNewExpQty(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-4 flex gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="Nominal Rp"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={handleAddExpense}
                    className="shrink-0 bg-[#1B5E86] text-white hover:bg-[#154B6B]"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {expenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-500">
                  Belum ada pengeluaran kas di shift ini. Tambahkan di atas jika
                  kasir membeli es batu, sayur, atau kebutuhan mendadak lainnya.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {expenses.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {idx + 1}. {exp.itemName}
                        </span>
                        <Badge variant="outline" className="ml-2 text-[11px]">
                          {exp.qtyLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-600">
                          - {formatRupiah(exp.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExpense(exp.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Hapus ${exp.itemName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. REKONSILIASI KAS AWAL, KAS AKHIR, SELISIH & CATATAN PENUTUP */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-[#1B5E86]" />
                3. Perhitungan Kas Awal, Kas Akhir &amp; Catatan Penutup
              </CardTitle>
              <CardDescription>
                Masukkan modal kas awal dan uang tunai fisik di laci saat tutup
                shift untuk melihat apakah ada selisih.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Kas Awal / Modal Laci (Rp)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {[0, 100000, 200000, 300000, 500000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setOpeningCashInput(String(val))}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {formatRupiah(val)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Kas Akhir Aktual (Uang Fisik di Laci)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    placeholder={String(expectedClosingCash)}
                    value={actualClosingCashInput}
                    onChange={(e) => setActualClosingCashInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setActualClosingCashInput(String(expectedClosingCash))
                    }
                    className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Isi Sesuai Ekspektasi ({formatRupiah(expectedClosingCash)})
                  </button>
                </div>
              </div>

              {/* Ringkasan Angka Kas & Selisih */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Kas Awal (Modal Laci)</span>
                  <span className="font-semibold text-slate-900">
                    {formatRupiah(openingCash)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>
                    (+) Pembayaran Tunai Masuk ({metrics.cashOrderCount} order)
                  </span>
                  <span className="font-semibold">
                    + {formatRupiah(metrics.cashRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-sky-700">
                  <span>
                    (i) Pembayaran QRIS Masuk ({metrics.qrisOrderCount} order —
                    Non-Laci)
                  </span>
                  <span className="font-semibold">
                    {formatRupiah(metrics.qrisRevenue)}
                  </span>
                </div>
                {metrics.cashRefundTotal > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>(-) Refund Tunai Pembatalan</span>
                    <span className="font-semibold">
                      - {formatRupiah(metrics.cashRefundTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-red-600">
                  <span>
                    (-) Pengeluaran Shift ({expenses.length} item belanja)
                  </span>
                  <span className="font-semibold">
                    - {formatRupiah(totalExpenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Total Kas Akhir Seharusnya di Laci</span>
                  <span>{formatRupiah(expectedClosingCash)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Total Kas Fisik Aktual di Laci</span>
                  <span>{formatRupiah(actualClosingCash)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="font-extrabold text-slate-900">
                    Status Selisih Kas Laci
                  </span>
                  <Badge
                    variant={
                      cashDifference === 0
                        ? "success"
                        : cashDifference > 0
                          ? "warning"
                          : "destructive"
                    }
                    className="text-xs font-extrabold"
                  >
                    {cashDifference === 0
                      ? "PAS / TIDAK ADA SELISIH (Rp 0)"
                      : cashDifference > 0
                        ? `SELISIH LEBIH (+ ${formatRupiah(cashDifference)})`
                        : `SELISIH KURANG (- ${formatRupiah(Math.abs(cashDifference))})`}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan Penutup Shift
                </label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Tulis catatan serah terima shift, kendala, atau keterangan selisih..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveAndPrint(true)}
                  className="min-h-12 flex-1 bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {isSaving
                    ? "Menyimpan..."
                    : "Simpan Tutupan Shift & Cetak Struk"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => window.print()}
                  className="min-h-12"
                >
                  <Printer className="mr-1.5 h-4 w-4" />
                  Cetak Pratinjau Sekarang
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 4. RIWAYAT TUTUPAN SHIFT SEBELUMNYA */}
          {recentReports.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-slate-600" />
                  Riwayat Tutupan Shift Terakhir ({recentReports.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {recentReports.map((rep) => (
                    <div
                      key={rep.reportId}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          #{rep.reportNo} &bull; {rep.shiftInCashierName} &rarr;{" "}
                          {rep.shiftOutCashierName}
                        </p>
                        <p className="text-slate-500">
                          Ditutup: {formatDateTimeWIB(rep.closedAtIso)} &bull;
                          Kas Akhir: {formatRupiah(rep.actualClosingCash)} (
                          {rep.cashDifference === 0
                            ? "Pas"
                            : rep.cashDifference > 0
                              ? `+${formatRupiah(rep.cashDifference)}`
                              : `-${formatRupiah(Math.abs(rep.cashDifference))}`}
                          )
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadSavedReport(rep)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Lihat &amp; Cetak Struk
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* KOLOM KANAN: PRATINJAU STRUK TUTUPAN SHIFT THERMAL (TERCETAK SAAT PRINT) */}
        <div className="lg:col-span-5">
          <div
            id="shift-closing-printable"
            className="mx-auto w-full max-w-[380px] rounded-2xl border-2 border-slate-900 bg-white p-5 font-mono text-xs text-black shadow-md"
          >
            {/* HEADER STRUK TUTUPAN SHIFT */}
            <div className="border-b-2 border-dashed border-black pb-3 text-center">
              <p className="text-sm font-black uppercase tracking-wider">
                1621 GROUP — {initialData.outlet.name}
              </p>
              {initialData.outlet.address && (
                <p className="mt-0.5 text-[10px] leading-snug">
                  {initialData.outlet.address}
                </p>
              )}
              <div className="mt-2 inline-block rounded border border-black px-2.5 py-0.5 text-[11px] font-black uppercase">
                STRUK LAPORAN TUTUPAN SHIFT
              </div>
              <p className="mt-1 text-[10px]">No: #{activeReportNo}</p>
            </div>

            {/* BAGIAN 1: PETUGAS SHIFT IN & SHIFT OUT */}
            <div className="space-y-1 border-b border-dashed border-black py-2.5 text-[11px]">
              <div className="flex justify-between">
                <span>Kasir Shift In:</span>
                <strong className="text-right">
                  {shiftInCashierName || "-"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Kasir Shift Out:</span>
                <strong className="text-right">
                  {shiftOutCashierName || "-"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Mulai Shift:</span>
                <span>{formatDateTimeWIB(metrics.shiftStartIso)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tutup Shift:</span>
                <span>{formatDateTimeWIB(metrics.shiftEndIso)}</span>
              </div>
            </div>

            {/* BAGIAN 2: REKONSILIASI KAS LACI & SELISIH */}
            <div className="space-y-1 border-b border-dashed border-black py-2.5 text-[11px]">
              <p className="font-black uppercase underline">
                A. PERHITUNGAN KAS &amp; PEMBAYARAN
              </p>
              <div className="flex justify-between">
                <span>Kas Awal (Modal Laci):</span>
                <span>{formatRupiah(openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span>(+) Bayar Tunai ({metrics.cashOrderCount}x):</span>
                <span>{formatRupiah(metrics.cashRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>(+) Bayar QRIS ({metrics.qrisOrderCount}x):</span>
                <span>{formatRupiah(metrics.qrisRevenue)}</span>
              </div>
              {metrics.cashRefundTotal > 0 && (
                <div className="flex justify-between">
                  <span>(-) Refund Tunai:</span>
                  <span>-{formatRupiah(metrics.cashRefundTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>(-) Pengeluaran Shift ({expenses.length}x):</span>
                <span>-{formatRupiah(totalExpenses)}</span>
              </div>

              <div className="mt-1.5 border-t border-dotted border-black pt-1.5">
                <div className="flex justify-between font-bold">
                  <span>Total Kas Akhir (Sistem):</span>
                  <span>{formatRupiah(expectedClosingCash)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kas Akhir Fisik (Aktual):</span>
                  <span>{formatRupiah(actualClosingCash)}</span>
                </div>
                <div className="flex justify-between font-black">
                  <span>Selisih Kas Laci:</span>
                  <span>
                    {cashDifference === 0
                      ? "PAS (Rp 0)"
                      : cashDifference > 0
                        ? `LEBIH +${formatRupiah(cashDifference)}`
                        : `KURANG -${formatRupiah(Math.abs(cashDifference))}`}
                  </span>
                </div>
              </div>
            </div>

            {/* BAGIAN 3: PEMBAYARAN SELF-ORDER VS ORDER MANUAL KASIR */}
            <div className="space-y-1 border-b border-dashed border-black py-2.5 text-[11px]">
              <p className="font-black uppercase underline">
                B. SELF-ORDER MEJA VS KASIR MANUAL
              </p>
              <div className="flex justify-between font-bold">
                <span>1. Self-Order QR ({metrics.selfOrderCount} trx):</span>
                <span>{formatRupiah(metrics.selfOrderTotal)}</span>
              </div>
              <div className="flex justify-between pl-3 text-[10px]">
                <span>- via QRIS Meja:</span>
                <span>{formatRupiah(metrics.selfOrderQrisTotal)}</span>
              </div>
              <div className="flex justify-between pl-3 text-[10px]">
                <span>- via Tunai Kasir:</span>
                <span>{formatRupiah(metrics.selfOrderCashTotal)}</span>
              </div>

              <div className="flex justify-between pt-1 font-bold">
                <span>2. Order Manual ({metrics.manualOrderCount} trx):</span>
                <span>{formatRupiah(metrics.manualOrderTotal)}</span>
              </div>
              <div className="flex justify-between pl-3 text-[10px]">
                <span>- via QRIS Kasir:</span>
                <span>{formatRupiah(metrics.manualOrderQrisTotal)}</span>
              </div>
              <div className="flex justify-between pl-3 text-[10px]">
                <span>- via Tunai Kasir:</span>
                <span>{formatRupiah(metrics.manualOrderCashTotal)}</span>
              </div>

              <div className="mt-1 flex justify-between border-t border-dotted border-black pt-1 font-black">
                <span>
                  TOTAL OMZET BERSIH ({metrics.paidOrders.length} trx):
                </span>
                <span>{formatRupiah(metrics.netSales)}</span>
              </div>
            </div>

            {/* BAGIAN 4: RINCIAN PENGELUARAN SHIFT (ES BATU, SAYUR, DLL.) */}
            <div className="space-y-1 border-b border-dashed border-black py-2.5 text-[11px]">
              <p className="font-black uppercase underline">
                C. PENGELUARAN DI SHIFT INI ({expenses.length})
              </p>
              {expenses.length === 0 ? (
                <p className="text-[10px] italic">
                  Tidak ada pengeluaran kas di shift ini.
                </p>
              ) : (
                <>
                  {expenses.map((exp, idx) => (
                    <div key={exp.id} className="flex justify-between">
                      <span>
                        {idx + 1}. {exp.itemName} ({exp.qtyLabel})
                      </span>
                      <span>{formatRupiah(exp.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-dotted border-black pt-1 font-bold">
                    <span>Total Pengeluaran Shift:</span>
                    <span>{formatRupiah(totalExpenses)}</span>
                  </div>
                </>
              )}
            </div>

            {/* BAGIAN 5: RINGKASAN SEMUA TRANSAKSI SHIFT */}
            <div className="space-y-1 border-b border-dashed border-black py-2.5 text-[11px]">
              <p className="font-black uppercase underline">
                D. RINGKASAN TRANSAKSI ({metrics.paidOrders.length} ORDER)
              </p>
              {metrics.paidOrders.length === 0 ? (
                <p className="text-[10px] italic">
                  Belum ada transaksi lunas pada rentang shift ini.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {metrics.paidOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="border-b border-dotted border-slate-300 pb-1 last:border-none"
                    >
                      <div className="flex justify-between font-bold">
                        <span>
                          #{ord.orderNo.slice(-4)} • {ord.tableName} (
                          {ord.source === "customer_qr" ? "Self" : "Kasir"}/
                          {ord.paymentMethod.toUpperCase()})
                        </span>
                        <span>{formatRupiah(ord.total)}</span>
                      </div>
                      <p className="text-[10px] leading-tight text-slate-700">
                        {formatTimeWIB(ord.createdAt)} — {ord.itemsSummary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BAGIAN 6: DAFTAR PEMBATALAN / REFUND (JIKA ADA) */}
            <div className="space-y-1 border-b border-dashed border-black py-2.5 text-[11px]">
              <p className="font-black uppercase underline">
                E. PEMBATALAN &amp; REFUND ({metrics.cancelledOrders.length})
              </p>
              {metrics.cancelledOrders.length === 0 ? (
                <p className="text-[10px] italic">
                  Tidak ada pembatalan pesanan di shift ini.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {metrics.cancelledOrders.map((canc) => (
                    <div
                      key={canc.id}
                      className="border-b border-dotted border-slate-300 pb-1 last:border-none"
                    >
                      <div className="flex justify-between font-bold">
                        <span>
                          #{canc.orderNo.slice(-4)} • {canc.tableName} (
                          {canc.status.toUpperCase()})
                        </span>
                        <span>{formatRupiah(canc.total)}</span>
                      </div>
                      <p className="text-[10px] leading-tight">
                        Alasan: {canc.cancelReason}
                        {canc.refundAmount > 0
                          ? ` • Refund: ${formatRupiah(canc.refundAmount)}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BAGIAN 7: CATATAN PENUTUP & TANDA TANGAN SERAH TERIMA */}
            <div className="space-y-2 pt-2.5 text-[11px]">
              <div>
                <p className="font-black uppercase underline">
                  F. CATATAN PENUTUP SHIFT:
                </p>
                <p className="mt-0.5 text-[10px] leading-snug">
                  {closingNotes || "-"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 text-center text-[10px]">
                <div>
                  <p className="font-bold">Kasir Shift In</p>
                  <div className="h-12" />
                  <p className="border-t border-black pt-1 font-bold">
                    ({shiftInCashierName || "................"})
                  </p>
                </div>
                <div>
                  <p className="font-bold">Kasir Shift Out</p>
                  <div className="h-12" />
                  <p className="border-t border-black pt-1 font-bold">
                    ({shiftOutCashierName || "................"})
                  </p>
                </div>
              </div>

              <p className="pt-2 text-center text-[10px]">
                Dicetak: {formatDateTimeWIB(new Date().toISOString())} WIB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

