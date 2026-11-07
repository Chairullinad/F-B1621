import { OutletManager } from "@/components/dashboard/outlet-manager";
import { requireStaffRole } from "@/server/auth";
import { listAllOutletsAction } from "@/server/outlets";

export const dynamic = "force-dynamic";

export default async function CabangPage() {
  await requireStaffRole(["owner"]);
  const { outlets, activeOutletId } = await listAllOutletsAction();

  return (
    <OutletManager
      initialOutlets={outlets}
      activeOutletId={activeOutletId}
    />
  );
}

