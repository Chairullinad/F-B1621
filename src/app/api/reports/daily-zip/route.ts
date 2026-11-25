import { NextResponse, type NextRequest } from "next/server";
import {
  buildDailyHoldingZipAndSummary,
  getHoldingSettingsPageData,
} from "@/server/holding-reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date") ?? undefined;
  const outletsParam = searchParams.get("outlets");

  const pageData = await getHoldingSettingsPageData(dateParam);
  const parsedOutletIds = outletsParam
    ? outletsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => pageData.outlets.some((o) => o.id === id))
    : pageData.settings.daily_report_outlet_ids;

  const bundle = await buildDailyHoldingZipAndSummary({
    dateWib: dateParam,
    outletIds:
      parsedOutletIds.length > 0
        ? parsedOutletIds
        : pageData.outlets.map((o) => o.id),
    sections: pageData.settings.daily_report_sections,
  });

  return new NextResponse(new Uint8Array(bundle.zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${bundle.zipFilename}"`,
      "Cache-Control": "no-store",
    },
  });
}
