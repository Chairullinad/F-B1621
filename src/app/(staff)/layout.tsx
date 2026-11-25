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
  const badgeOutletId =
    staff.role === "owner" ? staff.selectedOutletId : staff.outletId;

  const emptyBadges = {
    pending_orders: 0,
    pending_opnames: 0,
    pending_transfers: 0,
    low_stock: 0,
    lowStockItems: [],
  };

  const [badges, outletsData] = await Promise.all([
    badgeOutletId
      ? getStaffSidebarBadges(badgeOutletId)
      : Promise.resolve(emptyBadges),
    listAllOutletsAction().catch(() => ({
      outlets: [],
      activeOutletId: staff.selectedOutletId,
    })),
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
