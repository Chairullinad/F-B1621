import Link from "next/link";
import { StaffManagement } from "@/components/dashboard/staff-management";
import {
  listStaffMembersForOwner,
  requireStaffRole,
} from "@/server/auth";
import { listAllOutletsAction } from "@/server/outlets";

export const dynamic = "force-dynamic";

export default async function StafManagementPage() {
  const [owner, staffList, { outlets, activeOutletId }] = await Promise.all([
    requireStaffRole(["owner"]),
    listStaffMembersForOwner(),
    listAllOutletsAction(),
  ]);

  const isHoldingMode = !activeOutletId;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 dark:text-slate-100">
            Manajemen User, Cabang &amp; Hak Akses (Role)
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Kelola akun staf lintas cabang (Owner, Kasir, Staff Gudang, Kitchen,
            Pelayan), atur penugasan cabang, reset password, dan tinjau matriks
            hak akses operasional.
          </p>
        </div>

        {isHoldingMode && (
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 self-start sm:self-auto"
          >
            &larr; Kembali ke Dashboard Owner
          </Link>
        )}
      </div>

      <StaffManagement
        initialStaff={staffList}
        currentOwnerId={owner.userId}
        outlets={outlets}
        defaultOutletId={activeOutletId ?? outlets[0]?.id ?? owner.outletId}
      />
    </div>
  );
}

