import Image from "next/image";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#EEF6FF] via-[#E3F0FE] to-[#F7FBFF] flex flex-col justify-center items-center p-4 md:p-8 font-sans">
      <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-[28px] border border-sky-100 bg-white p-6 sm:p-8 shadow-[0_24px_60px_-15px_rgba(27,94,134,0.22)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 -right-6 h-44 w-60 opacity-25 mix-blend-multiply select-none"
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
          <ResetPasswordForm initialError={sp.error} />
        </div>
      </div>
    </main>
  );
}
