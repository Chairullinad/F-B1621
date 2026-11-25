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
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F4F9FF] via-[#E8F2FE] to-[#F8FBFF] flex flex-col justify-center items-center px-3 py-6 sm:p-6 font-sans">
      {/* Latar Belakang Minimalis & Fancy: Watermark Hidangan F&B Tajam (Tanpa Blur) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      >
        {/* Glow Biru Sangat Halus untuk Kedalaman */}
        <div className="absolute -top-36 left-1/4 h-96 w-96 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute -bottom-36 right-1/4 h-96 w-96 rounded-full bg-[#1E88E5]/12 blur-3xl" />

        {/* Pojok Kiri Atas: Matcha, Cappuccino, Waffle & Croissant (Tajam, High-Key Editorial) */}
        <div
          className="hidden sm:block absolute -top-8 -left-8 h-[320px] w-[320px] md:h-[380px] md:w-[380px] xl:h-[440px] xl:w-[440px] opacity-[0.34] mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at 32% 32%, black 28%, rgba(0,0,0,0.45) 54%, transparent 78%)",
            maskImage:
              "radial-gradient(circle at 32% 32%, black 28%, rgba(0,0,0,0.45) 54%, transparent 78%)",
          }}
        >
          <Image
            src="/images/login-bg-cafe.jpg"
            alt=""
            fill
            className="object-cover object-center"
            sizes="440px"
          />
        </div>

        {/* Pojok Kanan Atas: Ilustrasi 3D Café Bag, Burger, Kopi & Ramen (Tajam & Ringan) */}
        <div
          className="hidden sm:block absolute -top-4 -right-4 h-[270px] w-[270px] md:h-[330px] md:w-[330px] xl:h-[380px] xl:w-[380px] opacity-[0.30] mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at 64% 38%, black 26%, rgba(0,0,0,0.4) 52%, transparent 78%)",
            maskImage:
              "radial-gradient(circle at 64% 38%, black 26%, rgba(0,0,0,0.4) 52%, transparent 78%)",
          }}
        >
          <Image
            src="/images/login-fnb-mini.jpg"
            alt=""
            fill
            className="object-cover object-center"
            sizes="380px"
          />
        </div>

        {/* Pojok Kiri Bawah: Chicken Karaage, Gyoza & Iced Lemon Tea (Tajam & Bersih) */}
        <div
          className="hidden sm:block absolute -bottom-8 -left-8 h-[320px] w-[320px] md:h-[380px] md:w-[380px] xl:h-[440px] xl:w-[440px] opacity-[0.34] mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at 36% 66%, black 28%, rgba(0,0,0,0.45) 54%, transparent 78%)",
            maskImage:
              "radial-gradient(circle at 36% 66%, black 28%, rgba(0,0,0,0.45) 54%, transparent 78%)",
          }}
        >
          <Image
            src="/images/login-bg-japanese.jpg"
            alt=""
            fill
            className="object-cover object-center"
            sizes="440px"
          />
        </div>

        {/* Pojok Kanan Bawah: Artisan Ramen, Iced Coffee & Croissant (Tajam ala Referensi) */}
        <div
          className="hidden sm:block absolute -bottom-6 -right-6 h-[300px] w-[420px] md:h-[360px] md:w-[500px] xl:h-[430px] xl:w-[600px] opacity-[0.42] mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "radial-gradient(ellipse at 62% 64%, black 30%, rgba(0,0,0,0.5) 56%, transparent 80%)",
            maskImage:
              "radial-gradient(ellipse at 62% 64%, black 30%, rgba(0,0,0,0.5) 56%, transparent 80%)",
          }}
        >
          <Image
            src="/images/login-bg-food.jpg"
            alt=""
            fill
            className="object-cover object-center"
            sizes="600px"
          />
        </div>
      </div>

      {/* Layout 1 Kolom Terpusat: Karakter 3D Mengintip di Atas Kartu Login */}
      <div className="relative z-10 w-full max-w-[440px] flex flex-col items-center">
        {/* Karakter 3D Mengintip (Tepi menyatu halus tanpa garis persegi/flap) */}
        <div className="relative w-full aspect-[4/3] select-none pointer-events-none">
          <Image
            src="/images/login-top-mascot.jpg"
            alt="Maskot 3D f&b1621"
            fill
            className="object-contain object-bottom"
            sizes="(max-width: 640px) 100vw, 440px"
            priority
            style={{
              WebkitMaskImage:
                "radial-gradient(ellipse 42% 48% at 50% 52%, black 56%, transparent 92%)",
              maskImage:
                "radial-gradient(ellipse 42% 48% at 50% 52%, black 56%, transparent 92%)",
            }}
          />
        </div>

        {/* Kartu Putih Tunggal Minimalis & Fancy */}
        <div className="relative z-10 -mt-[21%] w-[92%] overflow-hidden rounded-[28px] border border-sky-100/90 bg-white px-6 pb-7 pt-5 sm:px-8 sm:pb-8 shadow-[0_24px_64px_-16px_rgba(27,94,134,0.20)]">
          {/* Watermark Hidangan F&B Tajam & Tipis di Pojok Kanan Atas Kartu (ala Referensi BiteBox) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 -right-5 h-44 w-60 opacity-[0.22] mix-blend-multiply select-none"
          >
            <Image
              src="/images/login-bg-food.jpg"
              alt=""
              fill
              className="object-cover object-left-bottom"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-white via-white/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
          </div>

          <div className="relative z-10">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
