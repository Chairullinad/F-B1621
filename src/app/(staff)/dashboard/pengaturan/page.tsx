import { OutletSettingsManager } from "@/components/dashboard/outlet-settings-manager";
import { getOutletAndNotificationSettings } from "@/server/master-data";

export default async function PengaturanPage() {
  const { outlet, notification } = await getOutletAndNotificationSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Pengaturan Outlet, Pajak, QRIS &amp; Notifikasi
        </h1>
        <p className="text-sm text-zinc-600">
          Kelola profil outlet, waktu kedaluwarsa order, pajak &amp; service
          charge (default mati), QRIS toko, batas diskon kasir, dan notifikasi
          email Owner. Setiap perubahan tercatat di Jejak Audit.
        </p>
      </div>

      <OutletSettingsManager
        initialOutlet={outlet}
        initialNotification={notification}
      />
    </div>
  );
}
