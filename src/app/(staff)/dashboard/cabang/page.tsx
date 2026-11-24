import { OutletManager } from "@/components/dashboard/outlet-manager";
import { requireStaffRole } from "@/server/auth";
import { listAllOutletsAction } from "@/server/outlets";

export const dynamic = "force-dynamic";

interface CabangPageProps {
  searchParams: Promise<{
    edit?: string;
    tambah?: string;
  }>;
}

export default async function CabangPage({ searchParams }: CabangPageProps) {
  await requireStaffRole(["owner"]);
  const [{ outlets, activeOutletId }, sp] = await Promise.all([
    listAllOutletsAction(),
    searchParams,
  ]);

  return (
    <OutletManager
      initialOutlets={outlets}
      activeOutletId={activeOutletId}
      initialEditOutletId={sp.edit}
      initialOpenAdd={sp.tambah === "1"}
    />
  );
}

