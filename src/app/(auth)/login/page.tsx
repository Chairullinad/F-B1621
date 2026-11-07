import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { LoginHeroCarousel } from "@/components/auth/login-hero-carousel";
import { getDefaultRouteForRole } from "@/lib/auth";
import { getCurrentStaffSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await getCurrentStaffSession();
  if (staff) {
    redirect(getDefaultRouteForRole(staff.role));
  }

  return (
    <main className="min-h-screen bg-[#F4F6F9] flex flex-col justify-center items-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Kolom Kiri: Hero & Carousel Ilustrasi (Persis Screenshot 1) */}
        <div className="hidden lg:flex lg:col-span-7 items-center justify-center">
          <LoginHeroCarousel />
        </div>

        {/* Kolom Kanan: Floating White Card Login */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-7 md:p-8 shadow-sm">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
