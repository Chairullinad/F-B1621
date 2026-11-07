import { NextResponse } from "next/server";
import { formatDateTimeWIB } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "pos-1621-fnb",
    status: "healthy",
    serverTimeWib: formatDateTimeWIB(new Date()),
    timestamp: new Date().toISOString(),
  });
}

