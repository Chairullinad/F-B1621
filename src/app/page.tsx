import { redirect } from "next/navigation";
import { getDefaultRouteForUser } from "@/lib/auth";
import { getCurrentStaffSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; type?: string }>;
}) {
  const sp = await searchParams;
  if (sp.code) {
    redirect(
      `/auth/callback?code=${encodeURIComponent(sp.code)}&next=/reset-password`
    );
  }

  const session = await getCurrentStaffSession();
  if (session) {
    redirect(getDefaultRouteForUser(session.role, session.customPermissions));
  }
  redirect("/login");
}
