import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OutletLandingEditor } from "@/components/dashboard/outlet-landing-editor";
import { requireStaffRole } from "@/server/auth";
import { listAllOutletsAction } from "@/server/outlets";

export const dynamic = "force-dynamic";

export default async function LandingPageSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ outletId?: string }>;
}) {
  await requireStaffRole(["owner"]);
  const [{ outlets, activeOutletId }, sp] = await Promise.all([
    listAllOutletsAction(),
    searchParams,
  ]);

  const initialOutlet =
    outlets.find((o) => o.id === sp.outletId) ??
    outlets.find((o) => o.id === activeOutletId) ??
    outlets[0];

  if (!initialOutlet) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Belum ada kios terdaftar.
        </p>
        <Link
          href="/dashboard/cabang?tambah=1"
          className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#1E88E5] px-4 text-xs font-bold text-white"
        >
          Buat Kios Baru
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#F4F7FA] dark:bg-slate-950 -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-[#1E88E5]">
              Beranda
            </Link>{" "}
            &gt;{" "}
            <Link href="/dashboard/cabang" className="hover:text-[#1E88E5]">
              Setting Kios
            </Link>{" "}
            &gt;{" "}
            <span className="text-slate-600 dark:text-slate-300">
              Landing Page &amp; Banner Iklan
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Landing Page Pelanggan, Banner Iklan &amp; Link Tombol
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Atur tampilan halaman sambutan saat pelanggan scan QR meja, unggah banner iklan, dan pasang link Penawaran Kerjasama, Reservasi, serta Kritik &amp; Saran.
          </p>
        </div>

        <Link
          href="/dashboard/cabang"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
          <span>Kembali ke Setting Kios</span>
        </Link>
      </div>

      <OutletLandingEditor outlet={initialOutlet} outlets={outlets} />
    </div>
  );
}
