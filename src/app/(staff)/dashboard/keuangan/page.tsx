import { FinancialReportTabs } from "@/components/dashboard/financial-report-tabs";
import { getFinancialReportData } from "@/server/accounting";

export const dynamic = "force-dynamic";

export default async function KeuanganPage() {
  const data = await getFinancialReportData();

  return <FinancialReportTabs initialData={data} />;
}

