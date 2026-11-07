import { MenuStockManager } from "@/components/dashboard/menu-stock-manager";
import { requireStaffRole } from "@/server/auth";
import { getMenuStockPageData } from "@/server/menu-stock";

export const dynamic = "force-dynamic";

interface StokMenuPageProps {
  searchParams: Promise<{
    outletId?: string;
  }>;
}

export default async function StokMenuPage({
  searchParams,
}: StokMenuPageProps) {
  await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const sp = await searchParams;

  const data = await getMenuStockPageData({
    outletId: sp.outletId,
  });

  return <MenuStockManager initialData={data} />;
}
