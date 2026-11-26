import { FinancialReportTabs } from "@/components/dashboard/financial-report-tabs";
import { getFinancialReportData } from "@/server/accounting";

export const dynamic = "force-dynamic";

interface KeuanganPageProps {
  searchParams: Promise<{
    outletId?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    tab?: string;
    date?: string;
  }>;
}

export default async function KeuanganPage({ searchParams }: KeuanganPageProps) {
  const sp = await searchParams;
  const data = await getFinancialReportData({
    outletId: sp.outletId,
    period: sp.period,
    startDate: sp.startDate,
    endDate: sp.endDate,
  });

  return (
    <FinancialReportTabs
      initialData={data}
      initialTab={sp.tab}
      initialEmailDate={sp.date}
    />
  );
}
