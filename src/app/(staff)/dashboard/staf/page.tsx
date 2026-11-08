import { StaffManagement } from "@/components/dashboard/staff-management";
import {
  listStaffMembersForOwner,
  requireStaffRole,
} from "@/server/auth";
import { listAllOutletsAction } from "@/server/outlets";

export const dynamic = "force-dynamic";

export default async function StafManagementPage() {
  const [owner, staffList, { outlets }] = await Promise.all([
    requireStaffRole(["owner"]),
    listStaffMembersForOwner(),
    listAllOutletsAction(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-slate-900 dark:text-slate-100">
          Manajemen User, Cabang &amp; Hak Akses (Role)
        </h1>
        <p className="text-[13px] text-slate-500">
          Kelola akun staf lintas cabang (Owner, Kasir, Staff Gudang, Kitchen,
          Pelayan), atur penugasan cabang, reset password, dan tinjau matriks
          hak akses operasional.
        </p>
      </div>

      <StaffManagement
        initialStaff={staffList}
        currentOwnerId={owner.userId}
        outlets={outlets}
        defaultOutletId={owner.outletId}
      />
    </div>
  );
}

