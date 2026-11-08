import { OperationalTabsShell } from "@/components/cashier/operational-tabs-shell";
import { getCashierWorkspaceData } from "@/server/cashier";
import {
  getKitchenWorkspaceData,
  getWaiterWorkspaceData,
} from "@/server/kitchen-waiter";

export const dynamic = "force-dynamic";

export default async function KasirPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, cashierData, kitchenData, waiterData] = await Promise.all([
    searchParams,
    getCashierWorkspaceData(),
    getKitchenWorkspaceData(),
    getWaiterWorkspaceData(),
  ]);

  const initialTab =
    tab === "kitchen" || tab === "dapur"
      ? "kitchen"
      : tab === "antar"
        ? "antar"
        : "kasir";

  return (
    <OperationalTabsShell
      cashierData={cashierData}
      kitchenData={kitchenData}
      waiterData={waiterData}
      initialTab={initialTab}
    />
  );
}
