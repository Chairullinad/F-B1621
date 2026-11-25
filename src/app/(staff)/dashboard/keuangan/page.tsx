import { FinancialReportTabs } from "@/components/dashboard/financial-report-tabs";
import { getFinancialReportData } from "@/server/accounting";
import { getDailyEmailTemplatePreview } from "@/server/holding-reports";

export const dynamic = "force-dynamic";

interface KeuanganPageProps {
  searchParams: Promise<{
    outletId?: string;
    period?: string;
    tab?: string;
    date?: string;
  }>;
}

export default async function KeuanganPage({ searchParams }: KeuanganPageProps) {
  const sp = await searchParams;
  const [data, dailyPreview] = await Promise.all([
    getFinancialReportData({
      outletId: sp.outletId,
      period: sp.period,
    }),
    getDailyEmailTemplatePreview(sp.date).catch(() => undefined),
  ]);

  return (
    <FinancialReportTabs
      initialData={data}
      initialTab={sp.tab}
      dailyEmailPreview={dailyPreview}
    />
  );
}
