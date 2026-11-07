import Link from "next/link";
import { Button } from "@/components/ui/button";

const STAFF_NAV = [
  { href: "/kasir", label: "Kasir" },
  { href: "/order-manual", label: "Order Manual" },
  { href: "/dapur", label: "Dapur" },
  { href: "/antar", label: "Antar" },
  { href: "/dashboard", label: "Dashboard Owner" },
];

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="text-base font-bold tracking-tight">
            POS 1621 F&amp;B
          </Link>
          <nav className="flex flex-wrap items-center gap-1.5">
            {STAFF_NAV.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
