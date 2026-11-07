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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-7 shadow-2xl sm:p-9">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-extrabold text-white shadow-md">
            16
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-blue-950">
              🍽️ f&amp;b1621
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Sistem POS, Inventory &amp; Akuntansi Terintegrasi (100 Meja QR)
            </p>
          </div>
        </div>

        <LoginForm />

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>Database: Supabase Realtime + RLS</span>
          <Link href="/" className="font-medium text-blue-600 hover:underline">
            Beranda Sistem →
          </Link>
        </div>
      </div>
    </main>
  );
}
