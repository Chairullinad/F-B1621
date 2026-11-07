import { TransferStockManager } from "@/components/dashboard/transfer-stock-manager";
import { getStockTransferPageData } from "@/server/inventory";

export const dynamic = "force-dynamic";

export default async function TransferStockPage() {
  const data = await getStockTransferPageData();

  return <TransferStockManager initialData={data} />;
}

