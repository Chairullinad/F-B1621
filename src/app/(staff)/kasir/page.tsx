import { CashierWorkspace } from "@/components/cashier/cashier-workspace";
import { getCashierWorkspaceData } from "@/server/cashier";

export const dynamic = "force-dynamic";

export default async function KasirPage() {
  const data = await getCashierWorkspaceData();

  return <CashierWorkspace initialData={data} />;
}
