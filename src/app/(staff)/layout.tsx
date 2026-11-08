import { StaffSidebarShell } from "@/components/staff/staff-sidebar-shell";
import { getNavItemsForRole } from "@/lib/auth";
import { logoutStaffAction, requireStaffRole } from "@/server/auth";
import { getStaffSidebarBadges } from "@/server/inventory";
import { listAllOutletsAction } from "@/server/outlets";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaffRole();
  const allowedNavItems = getNavItemsForRole(staff.role);
  const [badges, outletsData] = await Promise.all([
    getStaffSidebarBadges(staff.outletId),
    listAllOutletsAction().catch(() => ({ outlets: [], activeOutletId: staff.outletId })),
  ]);

  return (
    <StaffSidebarShell
      staff={{ fullName: staff.fullName, role: staff.role }}
      navItems={allowedNavItems}
      badges={badges}
      outlets={outletsData.outlets}
      activeOutletId={outletsData.activeOutletId}
      logoutAction={logoutStaffAction}
    >
      {children}
    </StaffSidebarShell>
  );
}
