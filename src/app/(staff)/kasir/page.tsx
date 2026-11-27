import { OperationalTabsShell } from "@/components/cashier/operational-tabs-shell";
import { hasUserPermission } from "@/lib/auth";
import { requireStaffRole } from "@/server/auth";
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
  const [{ tab }, staff] = await Promise.all([
    searchParams,
    requireStaffRole(["owner", "cashier"], "kasir"),
  ]);

  const canAccessKitchen = hasUserPermission(
    staff.role,
    staff.customPermissions,
    "dapur"
  );
  const canAccessWaiter = hasUserPermission(
    staff.role,
    staff.customPermissions,
    "antar"
  );

  const initialTab =
    (tab === "kitchen" || tab === "dapur") && canAccessKitchen
      ? "kitchen"
      : tab === "antar" && canAccessWaiter
        ? "antar"
        : tab === "shift"
          ? "shift"
          : "kasir";

  const [cashierData, kitchenData, waiterData, shiftData] = await Promise.all([
    getCashierWorkspaceData(),
    canAccessKitchen ? getKitchenWorkspaceData() : Promise.resolve(null),
    canAccessWaiter ? getWaiterWorkspaceData() : Promise.resolve(null),
    initialTab === "shift" ? getShiftClosingWorkspaceData() : Promise.resolve(null),
  ]);

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
