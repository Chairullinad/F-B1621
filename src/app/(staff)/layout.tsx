import { StaffSidebarShell } from "@/components/staff/staff-sidebar-shell";
import { getNavItemsForRole } from "@/lib/auth";
import { logoutStaffAction, requireStaffRole } from "@/server/auth";
import { getStaffSidebarBadges } from "@/server/inventory";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaffRole();
  const allowedNavItems = getNavItemsForRole(staff.role);
  const badges = await getStaffSidebarBadges(staff.outletId);

  return (
    <StaffSidebarShell
      staff={{ fullName: staff.fullName, role: staff.role }}
      navItems={allowedNavItems}
      badges={badges}
      logoutAction={logoutStaffAction}
    >
      {children}
    </StaffSidebarShell>
  );
}
