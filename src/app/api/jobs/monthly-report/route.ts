import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateAndSendMonthlyOwnerReport } from "@/server/owner-notifications";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${configuredSecret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "Tidak diizinkan." },
      { status: 401 }
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: outlets } = await admin.from("outlets").select("id");

    const results = [];
    for (const outlet of outlets ?? []) {
      const res = await generateAndSendMonthlyOwnerReport({
        outletId: String(outlet.id),
      });
      results.push(res);
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan job laporan bulanan.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
