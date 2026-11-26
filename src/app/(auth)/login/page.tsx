import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultRouteForUser } from "@/lib/auth";
import { getCurrentStaffSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await getCurrentStaffSession();
  if (staff) {
    redirect(getDefaultRouteForUser(staff.role, staff.customPermissions));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#D2E8FE] via-[#DFEEFE] to-[#EDF5FF] flex flex-col justify-center items-center px-2 py-6 sm:p-8 font-sans">
      {/* Latar Belakang Dekoratif Biru Lembut */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-sky-300/35 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#1E88E5]/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(rgba(30, 136, 229, 0.16) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Layout 1 Kolom Terpusat dengan Karakter 3D Mengintip di Atas Kartu */}
      <div className="relative z-10 w-full max-w-[440px] flex flex-col items-center">
        {/* Bagian Atas: Karakter 3D Biru Mengintip di Atas Tepi Kartu Putih */}
        <div
          className="relative w-full aspect-square select-none pointer-events-none"
          style={{ animation: "floatGentle 5s ease-in-out infinite" }}
        >
          <Image
            src="/images/login-top-mascot.jpg"
            alt="Ilustrasi 3D staf f&b1621"
            fill
            className="object-contain object-bottom"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 10%, black 100%), linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 10%, black 100%), linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
              WebkitMaskComposite: "source-in",
            }}
            sizes="440px"
            priority
          />
        </div>

        {/* Bagian Kartu Putih Menyambung Tepat di Bawah Tangan Karakter */}
        <div className="relative z-10 -mt-[34%] w-[84%] rounded-b-[28px] bg-white px-5 sm:px-7 pt-1 pb-7 shadow-[0_24px_50px_-16px_rgba(27,94,134,0.24)]">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
