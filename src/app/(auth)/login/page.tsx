import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultRouteForRole } from "@/lib/auth";
import { getCurrentStaffSession } from "@/server/auth";

export default async function LoginPage() {
  const staff = await getCurrentStaffSession();
  if (staff) {
    redirect(getDefaultRouteForRole(staff.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0A131C] via-[#16293B] to-[#0F1B27] px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl border border-[#2B4B69]/40 bg-white p-7 shadow-2xl sm:p-9">
        <div className="mb-6 flex items-center gap-3.5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <Image
              src="/logo-1621.png"
              alt="Logo f&b1621"
              width={56}
              height={56}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F1B27]">
              1621F&amp;B
            </h1>
            <p className="text-xs font-semibold text-[#3B7097]">
              Sistem POS, Inventory &amp; Akuntansi 5 Tab (100 Meja QR)
            </p>
          </div>
        </div>

        <LoginForm />

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>Sistem Terpusat &bull; Supabase Realtime</span>
          <Link href="/" className="font-semibold text-[#3B7097] hover:underline">
            Beranda Sistem &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
