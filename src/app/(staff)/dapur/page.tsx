import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { getKitchenWorkspaceData } from "@/server/kitchen-waiter";

export const dynamic = "force-dynamic";

export default async function DapurPage() {
  const data = await getKitchenWorkspaceData();

  return <KitchenBoard initialData={data} />;
}
