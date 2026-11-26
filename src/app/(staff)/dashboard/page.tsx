import { requireStaffRole } from "@/server/auth";
import { getEsbDashboardAnalytics } from "@/server/dashboard-analytics";
import { getOwnerHoldingAnalytics } from "@/server/owner-holding-analytics";
import { EsbDashboardView } from "@/components/dashboard/esb-dashboard-view";
import { OwnerHoldingDashboardView } from "@/components/dashboard/owner-holding-dashboard-view";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    period?: "today" | "month";
    outletId?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
    pilih_outlet?: string;
  }>;
}

export default async function OwnerDashboardPage({
  searchParams,
}: DashboardPageProps) {
  const staff = await requireStaffRole([
    "owner",
    "cashier",
    "warehouse",
    "kitchen",
    "waiter",
  ]);
  const sp = await searchParams;

  // Owner belum memilih outlet: tampilkan Portal Holding & Grafik Penjualan Per Outlet
  if (staff.role === "owner" && !staff.selectedOutletId) {
    const parsedYear = sp.year ? Number.parseInt(sp.year, 10) : undefined;
    const holdingData = await getOwnerHoldingAnalytics({
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      startDate: sp.startDate,
      endDate: sp.endDate,
    });

    return (
      <OwnerHoldingDashboardView
        initialData={holdingData}
        promptSelectOutlet={sp.pilih_outlet === "1"}
      />
    );
  }

  const data = await getEsbDashboardAnalytics({
    period: sp.period === "month" ? "month" : "today",
    outletId: sp.outletId ?? staff.selectedOutletId ?? undefined,
    startDate: sp.startDate,
    endDate: sp.endDate,
  });

  return <EsbDashboardView initialData={data} />;
}
