"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  Download,
  Mail,
  Send,
  ShieldAlert,
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
import type {
  DailyReportSections,
  InstantNotificationEvents,
} from "@/lib/types/database";
import {
  triggerManualDailyZipReportAction,
  updateHoldingSettingsAction,
  type HoldingSettingsPageData,
} from "@/server/holding-reports";

const SECTION_OPTIONS: ReadonlyArray<{
  key: keyof DailyReportSections;
  label: string;
  desc: string;
}> = [
  {
    key: "sales",
    label: "Penjualan, QRIS/Tunai & Daftar Transaksi",
    desc: "Penjualan kotor/bersih, diskon, refund, serta rincian per order CSV.",
  },
  {
    key: "profit_loss",
    label: "Laba Rugi Harian & HPP (BOM)",
    desc: "Pendapatan, HPP bahan baku, laba kotor, beban operasional, dan laba bersih.",
  },
  {
    key: "cash_flow",
    label: "Arus Kas Harian (Cash Flow)",
    desc: "Kas masuk penjualan/modal, kas keluar biaya/PO/aset, dan arus kas bersih.",
  },
  {
    key: "tax",
    label: "Rekap Pajak & Service Charge",
    desc: "Total PPN/PB1 dan service charge terkumpul per outlet.",
  },
  {
    key: "journals",
    label: "Buku Kas & Jurnal Umum Harian",
    desc: "Seluruh entri debit/kredit jurnal akuntansi harian dalam CSV.",
  },
  {
    key: "inventory",
    label: "Posisi Stok Bahan, Waste & PO",
    desc: "Stok akhir bahan baku, nilai aset persediaan, hutang supplier & waste.",
  },
  {
    key: "audit",
    label: "Log Jejak Audit Harian",
    desc: "Rekaman aktivitas penting staf dan sistem per outlet.",
  },
];

export function HoldingSettingsManager({
  initialData,
}: {
  initialData: HoldingSettingsPageData;
}) {
  const router = useRouter();
  const { settings, outlets, preview, migrationMissing } = initialData;

  const [ownerEmail, setOwnerEmail] = React.useState(
    settings.owner_email ?? ""
  );
  const [dailyReportEnabled, setDailyReportEnabled] = React.useState(
    settings.daily_report_enabled
  );
  const [dailyReportTimeWib, setDailyReportTimeWib] = React.useState(
    settings.daily_report_time_wib || "23:55"
  );
  const [selectedOutletIds, setSelectedOutletIds] = React.useState<string[]>(
    () =>
      settings.daily_report_outlet_ids.length > 0
        ? settings.daily_report_outlet_ids
        : outlets.map((o) => o.id)
  );
  const [sections, setSections] = React.useState<DailyReportSections>(
    settings.daily_report_sections
  );
  const [monthlyReportEnabled, setMonthlyReportEnabled] = React.useState(
    settings.monthly_report_enabled
  );
  const [instantEvents, setInstantEvents] =
    React.useState<InstantNotificationEvents>(settings.instant_events);
  const [syncToOutlets, setSyncToOutlets] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState(preview.dateWib);
  const [isPending, startTransition] = React.useTransition();

  function toggleOutlet(outletId: string) {
    setSelectedOutletIds((prev) =>
      prev.includes(outletId)
        ? prev.filter((id) => id !== outletId)
        : [...prev, outletId]
    );
  }

  function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateHoldingSettingsAction({
        ownerEmail,
        dailyReportEnabled,
        dailyReportTimeWib,
        dailyReportOutletIds: selectedOutletIds,
        dailyReportSections: sections,
        monthlyReportEnabled,
        instantEvents,
        syncToOutlets,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleSendNow() {
    startTransition(async () => {
      const res = await triggerManualDailyZipReportAction(selectedDate);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleDateChange(nextDate: string) {
    setSelectedDate(nextDate);
  }

  const downloadZipHref = `/api/reports/daily-zip?date=${encodeURIComponent(
    selectedDate
  )}&outlets=${encodeURIComponent(selectedOutletIds.join(","))}`;

  return (
    <div className="space-y-6">
      {migrationMissing && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-bold">
              Migrasi database <code>0010</code> belum dijalankan di Supabase
            </p>
            <p className="mt-0.5">
              Anda sudah dapat melihat dan mengunduh rekap laporan harian di
              bawah ini, tetapi untuk menyimpan jadwal otomatis ke database,
              jalankan file migrasi{" "}
              <code>20261107000010_user_permissions_and_daily_reports.sql</code>{" "}
              di Supabase SQL Editor terlebih dahulu.
            </p>
          </div>
        </div>
      )}

      {/* FORM PENGATURAN NOTIFIKASI OWNER & REPORT HARIAN ZIP */}
      <form onSubmit={handleSaveSettings} className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-5 w-5 text-[#1E88E5]" />
              Jadwal Report Harian Terkompresi (.zip) — 1 Email / Hari
            </CardTitle>
            <CardDescription>
              Seluruh outlet yang dicentang digabung menjadi{" "}
              <strong>1 email per hari</strong> dengan lampiran arsip{" "}
              <code>.zip</code> agar inbox tidak penuh dan mudah untuk backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="holding-owner-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Alamat Email Owner (Tujuan Report &amp; Alert)
                </label>
                <Input
                  id="holding-owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@1621group.id"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="holding-daily-time"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <Clock className="h-3.5 w-3.5 text-[#1E88E5]" />
                  <span>Jam Kirim Otomatis Harian (WIB)</span>
                </label>
                <Input
                  id="holding-daily-time"
                  type="time"
                  value={dailyReportTimeWib}
                  onChange={(e) => setDailyReportTimeWib(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Default <strong>23:55 WIB</strong>. Terkirim maksimal 1x/hari
                  setelah jam ini tercapai.
                </p>
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-3.5 py-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={dailyReportEnabled}
                onChange={(e) => setDailyReportEnabled(e.target.checked)}
                disabled={isPending}
                className="h-5 w-5 rounded border-slate-300 dark:border-slate-600"
              />
              <span>
                Aktifkan Pengiriman Otomatis Report Keuangan &amp; Akuntansi
                Harian (.zip)
              </span>
            </label>

            {/* Checklist Outlet yang Diikutsertakan */}
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#1E88E5]" />
                  Pilih Outlet yang Masuk ke Email Harian ({selectedOutletIds.length}/{outlets.length})
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedOutletIds(outlets.map((o) => o.id))
                    }
                    className="font-semibold text-[#1E88E5] hover:underline cursor-pointer"
                  >
                    Centang Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedOutletIds([])}
                    className="font-semibold text-slate-500 hover:underline cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 pt-1">
                {outlets.map((outlet) => {
                  const checked = selectedOutletIds.includes(outlet.id);
                  return (
                    <label
                      key={outlet.id}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        checked
                          ? "border-[#1E88E5] bg-sky-50/70 text-slate-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-slate-100"
                          : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOutlet(outlet.id)}
                          disabled={isPending}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                        />
                        <span className="truncate">{outlet.name}</span>
                      </span>
                      <Badge variant={outlet.isActive ? "success" : "outline"}>
                        {outlet.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checklist Isi Laporan Backup */}
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-[#1E88E5]" />
                Komponen Backup di Dalam File .zip
              </p>
              <div className="grid gap-2 sm:grid-cols-2 pt-1">
                {SECTION_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  >
                    <input
                      type="checkbox"
                      checked={sections[opt.key]}
                      onChange={(e) =>
                        setSections((prev) => ({
                          ...prev,
                          [opt.key]: e.target.checked,
                        }))
                      }
                      disabled={isPending}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kolom Kanan: Notifikasi Sensitif + Aksi Simpan & Kirim */}
        <Card className="lg:col-span-5 border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Notifikasi Email Owner &amp; Kejadian Sensitif
              </CardTitle>
              <CardDescription>
                Atur laporan bulanan serta peringatan email real-time saat ada
                transaksi atau perubahan sensitif di outlet.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={monthlyReportEnabled}
                  onChange={(e) => setMonthlyReportEnabled(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span>
                  Kirim Laporan Bulanan Otomatis (Penjualan Kotor, Refund,
                  Bersih, Diskon)
                </span>
              </label>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Alert Email Instan Kejadian Sensitif:
                </p>
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    checked={instantEvents.refund}
                    onChange={(e) =>
                      setInstantEvents((prev) => ({
                        ...prev,
                        refund: e.target.checked,
                      }))
                    }
                    disabled={isPending}
                    className="h-4 w-4 rounded"
                  />
                  <span>Saat terjadi Refund Tunai</span>
                </label>
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    checked={instantEvents.paid_cancellation}
                    onChange={(e) =>
                      setInstantEvents((prev) => ({
                        ...prev,
                        paid_cancellation: e.target.checked,
                      }))
                    }
                    disabled={isPending}
                    className="h-4 w-4 rounded"
                  />
                  <span>
                    Saat Pembatalan Order Sudah Bayar (PAID / READY / SERVED)
                  </span>
                </label>
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    checked={instantEvents.discount}
                    onChange={(e) =>
                      setInstantEvents((prev) => ({
                        ...prev,
                        discount: e.target.checked,
                      }))
                    }
                    disabled={isPending}
                    className="h-4 w-4 rounded"
                  />
                  <span>Saat Kasir Memberikan Diskon Order</span>
                </label>
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    checked={instantEvents.price_or_setting_change}
                    onChange={(e) =>
                      setInstantEvents((prev) => ({
                        ...prev,
                        price_or_setting_change: e.target.checked,
                      }))
                    }
                    disabled={isPending}
                    className="h-4 w-4 rounded"
                  />
                  <span>Saat Perubahan Harga Menu / Pajak / Outlet</span>
                </label>
              </div>

              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={syncToOutlets}
                  onChange={(e) => setSyncToOutlets(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 rounded"
                />
                <span>
                  Terapkan Email Owner, Laporan Bulanan &amp; Alert Sensitif ke
                  seluruh outlet
                </span>
              </label>

              {settings.last_daily_report_date && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-200">
                  Pengiriman otomatis terakhir:{" "}
                  <strong>{settings.last_daily_report_date}</strong>
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  <label
                    htmlFor="holding-send-date"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    <Calendar className="h-3.5 w-3.5 text-[#1E88E5]" />
                    <span>Tanggal Uji / Backup:</span>
                  </label>
                  <input
                    id="holding-send-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full min-h-11"
                  disabled={isPending}
                >
                  <Mail className="mr-1.5 h-4 w-4" />
                  {isPending
                    ? "Menyimpan..."
                    : "Simpan Pengaturan Notifikasi & Jadwal"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11"
                  disabled={isPending || !ownerEmail.trim()}
                  onClick={handleSendNow}
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  Kirim Email Report Harian (.zip) Sekarang
                </Button>

                <a
                  href={downloadZipHref}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <Download className="h-4 w-4 text-[#1E88E5]" />
                  <span>Download Backup .zip Tanggal {selectedDate}</span>
                </a>
              </div>
            </CardContent>
          </div>
        </Card>
      </form>
    </div>
  );
}
