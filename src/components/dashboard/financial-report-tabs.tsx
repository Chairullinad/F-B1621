"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  BookOpen,
  Download,
  Receipt,
  Scale,
  Wallet,
  X,
} from "lucide-react";
import { formatRupiah } from "@/lib/money";
import {
  createManualAccountingEntryAction,
  type FinancialReportData,
} from "@/server/accounting";

interface FinancialReportTabsProps {
  initialData: FinancialReportData;
}

type TabKey = "jurnal" | "labarugi" | "neraca" | "aruskas" | "pajak";

export function FinancialReportTabs({ initialData }: FinancialReportTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("jurnal");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Filter Jurnal
  const [journalFilter, setJournalFilter] = useState<string>("all");
  const [showManualModal, setShowManualModal] = useState(false);

  // Form Catat Beban/Modal
  const [category, setCategory] = useState<
    | "expense_salary"
    | "expense_rent"
    | "expense_utility"
    | "expense_other"
    | "asset_purchase"
    | "owner_capital"
  >("expense_utility");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const filteredJournals = initialData.journals.filter((j) => {
    if (journalFilter === "all") return true;
    return j.source_type === journalFilter;
  });

  function handleCreateManualJournal(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createManualAccountingEntryAction({
        category,
        description: description.trim(),
        amount: Number(amount),
      });
      setFeedback(res);
      if (res.ok) {
        setShowManualModal(false);
        setDescription("");
        setAmount("");
        router.refresh();
      }
    });
  }

  function handleExportCsv() {
    const headers = [
      "No. Jurnal",
      "Tanggal",
      "Keterangan",
      "Akun Debit",
      "Akun Kredit",
      "Nominal (Rp)",
      "Tipe Sumber",
    ];
    const rows = filteredJournals.map((j) => [
      `"${j.journal_no}"`,
      `"${j.entry_date}"`,
      `"${j.description.replace(/"/g, '""')}"`,
      `"${j.debit_account}"`,
      `"${j.credit_account}"`,
      j.amount,
      `"${j.source_type}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `fnb1621_jurnal_umum_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const { kpi, incomeStatement, balanceSheet, cashFlow, taxSummary } =
    initialData;

  return (
    <div className="space-y-5 bg-[#F4F7FA] dark:bg-slate-950 -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800 dark:text-slate-100">
      {/* Breadcrumb & Header Banner ala ESB POSLite */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-[12px] text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-[#1E88E5]">
              Beranda
            </Link>{" "}
            &gt;{" "}
            <span className="text-slate-600 dark:text-slate-300">
              Pembukuan &amp; Laporan Keuangan
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100">
              Pembukuan Kedai &amp; Akuntansi ({initialData.periodLabel})
            </h1>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Catat Kas Masuk / Kas Keluar harian serta pantau Jurnal Umum, Laba Rugi, Neraca, Arus Kas, dan Pajak secara otomatis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory("owner_capital");
              setShowManualModal(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
          >
            <ArrowDownCircle className="h-4 w-4" />
            <span>+ Kas Masuk / Modal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory("expense_utility");
              setShowManualModal(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-[13px] font-semibold text-white hover:bg-[#1976D2] cursor-pointer"
          >
            <ArrowUpCircle className="h-4 w-4" />
            <span>+ Kas Keluar / Biaya</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Total Pendapatan Bersih
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">
            {formatRupiah(kpi.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dine-in, Takeaway, dan QR Meja
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            HPP (Bahan Baku / BOM)
          </p>
          <p className="mt-1.5 text-2xl font-bold text-amber-600">
            {formatRupiah(kpi.totalCogs)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Rasio HPP:{" "}
            <span className="font-semibold text-slate-800">
              {kpi.cogsPercent}%
            </span>{" "}
            dari omset
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Laba Bersih (Net Profit)
          </p>
          <p
            className={`mt-1.5 text-2xl font-bold ${
              kpi.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatRupiah(kpi.netProfit)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Margin Bersih:{" "}
            <span className="font-semibold text-slate-800">
              {kpi.netMarginPercent}%
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Nilai Stok & Hutang
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">
            {formatRupiah(kpi.inventoryValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hutang Supplier:{" "}
            <span className="font-semibold text-rose-600">
              {formatRupiah(kpi.supplierPayable)}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("jurnal")}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "jurnal"
              ? "border-[#1E88E5] text-[#1E88E5]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Buku Kas &amp; Jurnal Umum</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {initialData.journals.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("labarugi")}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "labarugi"
              ? "border-[#1E88E5] text-[#1E88E5]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Laba Rugi</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("neraca")}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "neraca"
              ? "border-[#1E88E5] text-[#1E88E5]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Neraca</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("aruskas")}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "aruskas"
              ? "border-[#1E88E5] text-[#1E88E5]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Arus Kas</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pajak")}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-[13px] font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "pajak"
              ? "border-[#1E88E5] text-[#1E88E5]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Rekap Pajak</span>
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. JURNAL UMUM */}
      {activeTab === "jurnal" && (
        <div className="space-y-4 rounded-b-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Buku Jurnal Umum Transaksi
              </h3>
              <p className="text-xs text-slate-500">
                Semua mutasi finansial tercatat otomatis dengan metode double-entry (Debit = Kredit).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Filter Sumber:</label>
              <select
                value={journalFilter}
                onChange={(e) => setJournalFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="all">Semua Transaksi</option>
                <option value="order_paid">Penjualan POS / QR</option>
                <option value="order_cogs">HPP Bahan Baku (BOM)</option>
                <option value="po_received">Penerimaan PO Supplier</option>
                <option value="po_paid">Pelunasan Hutang Supplier</option>
                <option value="waste">Beban Waste & Spoilage</option>
                <option value="opname">Penyesuaian Stock Opname</option>
                <option value="transfer">Mutasi Antar Lokasi</option>
                <option value="expense_salary">Gaji Karyawan</option>
                <option value="expense_rent">Sewa Tempat</option>
                <option value="expense_utility">Listrik & Air</option>
                <option value="expense_other">Beban Operasional Lainnya</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wider text-slate-500 uppercase">
                  <th className="px-3 py-3">No. Jurnal</th>
                  <th className="px-3 py-3">Tanggal</th>
                  <th className="px-3 py-3">Keterangan</th>
                  <th className="px-3 py-3">Akun Debit</th>
                  <th className="px-3 py-3">Akun Kredit</th>
                  <th className="px-3 py-3 text-right">Nominal</th>
                  <th className="px-3 py-3 text-center">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-3 font-mono text-xs font-bold text-slate-900">
                      {j.journal_no}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {j.entry_date}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {j.description}
                      {j.reference_id && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs text-slate-600">
                          {j.reference_id}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-emerald-700">
                      {j.debit_account}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-blue-700">
                      {j.credit_account}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(j.amount)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                        {j.source_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. LABA RUGI */}
      {activeTab === "labarugi" && (
        <div className="space-y-6 rounded-b-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Laporan Laba Rugi (Income Statement)
            </h3>
            <p className="text-xs text-slate-500">
              Periode {initialData.periodLabel} • Metode Akrual Sesuai Standar Akuntansi Keuangan
            </p>
          </div>

          <div className="space-y-6">
            {/* Bagian Pendapatan */}
            <div>
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                1. Pendapatan Usaha (Revenue)
              </h4>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Penjualan Dine-in (Kasir Manual)</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.dineInRevenue)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Penjualan Takeaway / Bungkus</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.takeawayRevenue)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Penjualan QR Meja Mandiri (Customer)</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.qrTableRevenue)}</span>
                </div>
                {incomeStatement.refundAmount > 0 && (
                  <div className="flex justify-between py-1 text-rose-600">
                    <span>Retur & Pembatalan Order (Refunds)</span>
                    <span className="font-mono">({formatRupiah(incomeStatement.refundAmount)})</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Total Pendapatan Bersih</span>
                  <span className="font-mono text-base">{formatRupiah(incomeStatement.totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Bagian HPP */}
            <div>
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                2. Beban Pokok Penjualan (HPP / COGS)
              </h4>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Beban Bahan Baku (Berdasarkan Resep & BOM Penjualan)</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.cogsAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-amber-700">
                  <span>Total HPP</span>
                  <span className="font-mono text-base">{formatRupiah(incomeStatement.cogsAmount)}</span>
                </div>
              </div>
            </div>

            {/* Laba Kotor */}
            <div className="flex justify-between rounded-xl bg-slate-50 p-4 font-bold text-slate-900">
              <span className="text-base">LABA KOTOR (Gross Profit)</span>
              <span className="font-mono text-lg text-emerald-700">
                {formatRupiah(incomeStatement.grossProfit)}
              </span>
            </div>

            {/* Beban Operasional */}
            <div>
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                3. Beban Operasional (Operating Expenses)
              </h4>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Beban Gaji Karyawan (Kasir, Dapur, Gudang, Pelayan)</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.salaryExpense)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Beban Sewa Tempat Outlet</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.rentExpense)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Beban Listrik, Air, & Gas</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.utilityExpense)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Beban Waste, Rusak & Spoilage Bahan Baku</span>
                  <span className="font-mono">{formatRupiah(incomeStatement.wasteExpense)}</span>
                </div>
                {incomeStatement.opnameExpense > 0 && (
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Beban Selisih Kurang Stock Opname</span>
                    <span className="font-mono">{formatRupiah(incomeStatement.opnameExpense)}</span>
                  </div>
                )}
                {incomeStatement.otherExpense > 0 && (
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Beban Operasional Lainnya</span>
                    <span className="font-mono">{formatRupiah(incomeStatement.otherExpense)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-rose-700">
                  <span>Total Beban Operasional</span>
                  <span className="font-mono text-base">{formatRupiah(incomeStatement.totalOperatingExpenses)}</span>
                </div>
              </div>
            </div>

            {/* Laba Bersih */}
            <div className="flex justify-between rounded-2xl bg-blue-50 p-5 font-bold text-slate-900 border border-blue-200">
              <div>
                <span className="text-lg text-blue-900">LABA BERSIH (Net Profit)</span>
                <p className="text-xs text-blue-700 font-normal">Setelah HPP dan Seluruh Biaya Operasional</p>
              </div>
              <span className={`font-mono text-2xl ${incomeStatement.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatRupiah(incomeStatement.netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. NERACA */}
      {activeTab === "neraca" && (
        <div className="space-y-6 rounded-b-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Neraca Keuangan (Balance Sheet)
            </h3>
            <p className="text-xs text-slate-500">
              Per {initialData.periodLabel} • Aset = Liabilitas + Ekuitas (Keseimbangan Terverifikasi)
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sisi Kiri: Aset */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">
                ASET (HARTA)
              </h4>

              <div className="space-y-2 text-sm">
                <p className="text-xs font-bold text-slate-500">Aset Lancar</p>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Kas & Rekening Bank</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.cashAndBank)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Persediaan Bahan Baku (Gudang/Dapur/Bar)</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.inventoryValue)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                  <span>Total Aset Lancar</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.totalCurrentAssets)}</span>
                </div>

                <p className="pt-3 text-xs font-bold text-slate-500">Aset Tetap (Peralatan & Inventaris)</p>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Peralatan Dapur & KDS</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.kitchenEquipment)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Meja, Kursi & Interior Restoran</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.tablesAndChairs)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-500">
                  <span>Akumulasi Penyusutan Aset Tetap</span>
                  <span className="font-mono">({formatRupiah(balanceSheet.accumulatedDepreciation)})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                  <span>Total Aset Tetap</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.totalFixedAssets)}</span>
                </div>

                <div className="mt-4 flex justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 font-bold text-emerald-900">
                  <span>TOTAL ASET</span>
                  <span className="font-mono text-base">{formatRupiah(balanceSheet.totalAssets)}</span>
                </div>
              </div>
            </div>

            {/* Sisi Kanan: Liabilitas & Ekuitas */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">
                LIABILITAS & EKUITAS
              </h4>

              <div className="space-y-2 text-sm">
                <p className="text-xs font-bold text-slate-500">Liabilitas (Kewajiban)</p>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Hutang Usaha ke Supplier (PO Belum Lunas)</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.supplierPayables)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Hutang Pajak PPN / PB1 Restoran</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.taxPayables)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                  <span>Total Liabilitas</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.totalLiabilities)}</span>
                </div>

                <p className="pt-3 text-xs font-bold text-slate-500">Ekuitas (Modal Pemilik)</p>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Modal Disetor Pemilik</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.ownerCapital)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Laba Berjalan Periode Ini</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.currentEarnings)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                  <span>Total Ekuitas</span>
                  <span className="font-mono">{formatRupiah(balanceSheet.totalEquity)}</span>
                </div>

                <div className="mt-4 flex justify-between rounded-xl bg-blue-50 border border-blue-200 p-3 font-bold text-blue-900">
                  <span>TOTAL LIABILITAS & EKUITAS</span>
                  <span className="font-mono text-base">{formatRupiah(balanceSheet.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ARUS KAS */}
      {activeTab === "aruskas" && (
        <div className="space-y-6 rounded-b-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Laporan Arus Kas (Cash Flow Statement)
            </h3>
            <p className="text-xs text-slate-500">
              Metode Langsung • Aliran uang tunai dan transfer bank riil
            </p>
          </div>

          <div className="space-y-6 text-sm">
            <div>
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                1. Arus Kas dari Aktivitas Operasional
              </h4>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Penerimaan Kas dari Pelanggan (+)</span>
                  <span className="font-mono text-emerald-700">{formatRupiah(cashFlow.cashFromCustomers)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Pembayaran Kas ke Supplier Bahan Baku (-)</span>
                  <span className="font-mono text-rose-700">({formatRupiah(cashFlow.cashToSuppliers)})</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Pembayaran Gaji Karyawan (-)</span>
                  <span className="font-mono text-rose-700">({formatRupiah(cashFlow.cashForSalaries)})</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Pembayaran Biaya Operasional Sewa, Listrik & Air (-)</span>
                  <span className="font-mono text-rose-700">({formatRupiah(cashFlow.cashForOperatingExpenses)})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Arus Kas Bersih Operasional</span>
                  <span className="font-mono">{formatRupiah(cashFlow.netOperatingCashFlow)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                2. Arus Kas dari Aktivitas Investasi
              </h4>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Pembelian Peralatan Dapur & Perangkat Kasir (-)</span>
                  <span className="font-mono text-rose-700">({formatRupiah(cashFlow.equipmentPurchases)})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Arus Kas Bersih Investasi</span>
                  <span className="font-mono">({formatRupiah(Math.abs(cashFlow.netInvestingCashFlow))})</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                3. Arus Kas dari Aktivitas Pendanaan
              </h4>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Setoran Modal Awal Pemilik Restoran (+)</span>
                  <span className="font-mono text-emerald-700">{formatRupiah(cashFlow.ownerCapitalInflow)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between rounded-xl bg-slate-900 p-4 font-bold text-white">
              <span>KENAIKAN / SALDO AKHIR KAS & BANK</span>
              <span className="font-mono text-lg text-emerald-400">
                {formatRupiah(balanceSheet.cashAndBank)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. REKAP PAJAK */}
      {activeTab === "pajak" && (
        <div className="space-y-6 rounded-b-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Rekapitulasi Pajak Restoran & Usaha (Tax Summary)
            </h3>
            <p className="text-xs text-slate-500">
              Perhitungan estimasi PPN / PB1 Restoran, PPh 21 Karyawan, dan PPh Final UMKM 0.5% (PP 55/2022)
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">PPN / PB1 Terutang</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatRupiah(taxSummary.ppnPayable)}</p>
              <p className="text-2xs text-slate-500">Keluaran: {formatRupiah(taxSummary.ppnOutput)} - Masukan: {formatRupiah(taxSummary.ppnInput)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">PPh 21 Karyawan</p>
              <p className="mt-1 text-xl font-bold text-blue-700">{formatRupiah(taxSummary.pph21)}</p>
              <p className="text-2xs text-slate-500">Estimasi potongan PPh 21 atas beban gaji</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">PPh Final UMKM (0.5%)</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{formatRupiah(taxSummary.pphFinalUmkm)}</p>
              <p className="text-2xs text-slate-500">Skema PP 55/2022 atas peredaran bruto</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wider text-slate-500 uppercase">
                  <th className="px-3 py-3">Jenis Pajak</th>
                  <th className="px-3 py-3">Masa / Periode</th>
                  <th className="px-3 py-3 text-right">DPP (Dasar Pengenaan Pajak)</th>
                  <th className="px-3 py-3 text-center">Tarif</th>
                  <th className="px-3 py-3 text-right">Pajak Terutang</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taxSummary.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.taxType}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{row.period}</td>
                    <td className="px-3 py-3 text-right font-mono font-medium text-slate-800">
                      {formatRupiah(row.dppAmount)}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs font-bold text-blue-600">
                      {row.rateLabel}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(row.taxAmount)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CATAT BEBAN / MODAL MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-bold text-slate-900">
                Catat Kas Masuk / Kas Keluar (Pembukuan)
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualJournal} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Kategori Transaksi
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as
                        | "expense_salary"
                        | "expense_rent"
                        | "expense_utility"
                        | "expense_other"
                        | "asset_purchase"
                        | "owner_capital"
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="expense_salary">Beban Gaji Karyawan</option>
                  <option value="expense_rent">Beban Sewa Tempat</option>
                  <option value="expense_utility">Beban Listrik, Air, & Gas</option>
                  <option value="expense_other">Beban Operasional Lainnya</option>
                  <option value="asset_purchase">Pembelian Aset Tetap (Peralatan)</option>
                  <option value="owner_capital">Setoran Modal Pemilik</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Keterangan / Memo Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Pembayaran tagihan listrik PLN bulan berjalan"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Nominal (Rupiah)
                </label>
                <input
                  type="number"
                  min="1000"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Contoh: 1500000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan ke Jurnal Umum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
