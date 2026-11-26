import { OutletSettingsManager } from "@/components/dashboard/outlet-settings-manager";
import { getOutletAndNotificationSettings } from "@/server/master-data";

export default async function PengaturanPage() {
  const { outlet } = await getOutletAndNotificationSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Pengaturan Pajak, Servis, QRIS &amp; Profil Outlet
        </h1>
        <p className="text-sm text-zinc-600 dark:text-slate-400">
          Kelola profil &amp; WiFi struk outlet, waktu kedaluwarsa order, pajak
          &amp; service charge (default mati), batas diskon kasir, serta aktif /
          nonaktifkan QRIS toko. Setiap perubahan tercatat di Jejak Audit.
        </p>
      </div>

      <OutletSettingsManager initialOutlet={outlet} />
    </div>
  );
}
