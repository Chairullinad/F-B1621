import { requireStaffRole } from "@/server/auth";
import { getEsbDashboardAnalytics } from "@/server/dashboard-analytics";
import { EsbDashboardView } from "@/components/dashboard/esb-dashboard-view";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    period?: "today" | "month";
    outletId?: string;
  }>;
}

export default async function OwnerDashboardPage({
  searchParams,
}: DashboardPageProps) {
  await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const sp = await searchParams;

  const data = await getEsbDashboardAnalytics({
    period: sp.period === "month" ? "month" : "today",
    outletId: sp.outletId,
  });

  return <EsbDashboardView initialData={data} />;
}
