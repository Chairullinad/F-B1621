import { FinancialReportTabs } from "@/components/dashboard/financial-report-tabs";
import { getFinancialReportData } from "@/server/accounting";

export const dynamic = "force-dynamic";

interface KeuanganPageProps {
  searchParams: Promise<{
    outletId?: string;
    tab?: string;
  }>;
}

export default async function KeuanganPage({ searchParams }: KeuanganPageProps) {
  const sp = await searchParams;
  const data = await getFinancialReportData({ outletId: sp.outletId });

  return <FinancialReportTabs initialData={data} initialTab={sp.tab} />;
}

