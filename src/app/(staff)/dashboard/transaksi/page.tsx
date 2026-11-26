import { TransactionsHistoryView } from "@/components/dashboard/transactions-history-view";
import { getTransactionsDashboardData } from "@/server/manual-order-and-transactions";

export const dynamic = "force-dynamic";

export default async function DashboardTransaksiPage({
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
    sp.period === "7d" || sp.period === "30d" || sp.period === "all"
      ? sp.period
      : "today";

  const data = await getTransactionsDashboardData({
    period,
    startDate: sp.startDate,
    endDate: sp.endDate,
    outletId: sp.outletId,
  });

  return <TransactionsHistoryView initialData={data} activePeriod={period} />;
}
