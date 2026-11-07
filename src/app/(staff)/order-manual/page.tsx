import { ManualOrderPos } from "@/components/cashier/manual-order-pos";
import { getManualOrderWorkspaceData } from "@/server/manual-order-and-transactions";

export const dynamic = "force-dynamic";

export default async function OrderManualPage() {
  const data = await getManualOrderWorkspaceData();

  return <ManualOrderPos initialData={data} />;
}
