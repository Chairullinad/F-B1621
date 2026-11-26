import { AuditTrailExplorer } from "@/components/dashboard/audit-trail-explorer";
import { getAuditTrailDashboardData } from "@/server/audit-trail";

export const dynamic = "force-dynamic";

export default async function DashboardAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    outletId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const sp = await searchParams;
  const period =
    sp.period === "today" ||
    sp.period === "7d" ||
    sp.period === "30d" ||
    sp.period === "all"
      ? sp.period
      : "7d";

  const data = await getAuditTrailDashboardData({
    period,
    startDate: sp.startDate,
    endDate: sp.endDate,
    outletId: sp.outletId,
  });

  return <AuditTrailExplorer initialData={data} activePeriod={period} />;
}
