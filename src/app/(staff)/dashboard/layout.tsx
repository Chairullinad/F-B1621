import { requireStaffRole } from "@/server/auth";

export default async function DashboardOwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffRole(["owner", "warehouse", "cashier"]);
  return <>{children}</>;
}

