import { WaiterBoard } from "@/components/waiter/waiter-board";
import { getWaiterWorkspaceData } from "@/server/kitchen-waiter";

export const dynamic = "force-dynamic";

export default async function AntarPage() {
  const data = await getWaiterWorkspaceData();

  return <WaiterBoard initialData={data} />;
}
