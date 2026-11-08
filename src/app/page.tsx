import { redirect } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/auth";
import { getCurrentStaffSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentStaffSession();
  if (session) {
    redirect(getDefaultRouteForRole(session.role));
  }
  redirect("/login");
}
