import { InventoryManager } from "@/components/dashboard/inventory-manager";
import { getInventoryPageData } from "@/server/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const data = await getInventoryPageData();

  return <InventoryManager initialData={data} />;
}
