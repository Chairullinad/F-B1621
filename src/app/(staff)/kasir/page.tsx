import { OperationalTabsShell } from "@/components/cashier/operational-tabs-shell";
import { getCashierWorkspaceData } from "@/server/cashier";
import { getShiftClosingWorkspaceData } from "@/server/cashier-shift";
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
  const [{ tab }, cashierData, kitchenData, waiterData, shiftData] =
    await Promise.all([
      searchParams,
      getCashierWorkspaceData(),
      getKitchenWorkspaceData(),
      getWaiterWorkspaceData(),
      getShiftClosingWorkspaceData(),
    ]);

  const initialTab =
    tab === "kitchen" || tab === "dapur"
      ? "kitchen"
      : tab === "antar"
        ? "antar"
        : tab === "shift"
          ? "shift"
          : "kasir";

  return (
    <OperationalTabsShell
      cashierData={cashierData}
      kitchenData={kitchenData}
      waiterData={waiterData}
      shiftData={shiftData}
      initialTab={initialTab}
    />
  );
}
