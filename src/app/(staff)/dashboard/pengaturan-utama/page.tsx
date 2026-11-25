import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HoldingSettingsManager } from "@/components/dashboard/holding-settings-manager";
import { getHoldingSettingsPageData } from "@/server/holding-reports";

export const dynamic = "force-dynamic";

interface PengaturanUtamaPageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function PengaturanUtamaPage({
  searchParams,
}: PengaturanUtamaPageProps) {
  const sp = await searchParams;
  const data = await getHoldingSettingsPageData(sp.date);

  return (
    <div className="space-y-5 bg-[#F4F7FA] dark:bg-slate-950 -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[12px] text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-[#1E88E5]">
              Dashboard Owner
            </Link>{" "}
            &gt;{" "}
            <span className="text-slate-600 dark:text-slate-300">
              Pengaturan &amp; Backup Laporan Harian
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Pengaturan Notifikasi Owner &amp; Laporan Harian Outlet
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Atur email notifikasi Owner, pilih outlet &amp; komponen backup
            keuangan-akuntansi harian (terkirim 1x sehari dalam 1 arsip{" "}
            <code>.zip</code>), serta pantau rekap harian setiap outlet.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
          <span>Kembali ke Dashboard Utama</span>
        </Link>
      </div>

      <HoldingSettingsManager initialData={data} />
    </div>
  );
}
