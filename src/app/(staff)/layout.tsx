import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNavItemsForRole, ROLE_LABELS_ID } from "@/lib/auth";
import { logoutStaffAction, requireStaffRole } from "@/server/auth";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaffRole();
  const allowedNavItems = getNavItemsForRole(staff.role);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="text-base font-bold tracking-tight">
              POS 1621 F&amp;B
            </Link>
            <Badge variant="secondary">{ROLE_LABELS_ID[staff.role]}</Badge>
            <span className="hidden text-sm text-zinc-600 sm:inline">
              {staff.fullName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <nav className="flex flex-wrap items-center gap-1">
              {allowedNavItems.map((item) => (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>

            <form action={logoutStaffAction}>
              <Button type="submit" variant="outline" size="sm">
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
