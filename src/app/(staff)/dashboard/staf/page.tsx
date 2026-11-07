import { StaffManagement } from "@/components/dashboard/staff-management";
import {
  listStaffMembersForOwner,
  requireStaffRole,
} from "@/server/auth";

export default async function StafManagementPage() {
  const owner = await requireStaffRole(["owner"]);
  const staffList = await listStaffMembersForOwner();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manajemen Staf &amp; Role</h1>
        <p className="text-sm text-zinc-600">
          Kelola akun Owner, Kasir, Dapur, dan Pelayan. Perubahan role dan
          status aktif staf langsung berlaku dan tercatat di Jejak Audit.
        </p>
      </div>

      <StaffManagement
        initialStaff={staffList}
        currentOwnerId={owner.userId}
      />
    </div>
  );
}

