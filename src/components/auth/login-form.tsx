"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginStaffAction } from "@/server/auth";

const QUICK_ROLES = [
  {
    icon: "👑",
    label: "Owner",
    desc: "Akses Dashboard, Keuangan 5 Tab, Multi-Outlet, Inventory & Pengaturan",
    email: "owner@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "🧑‍🍳",
    label: "Kasir",
    desc: "Akses Layar Kasir Meja, POS Manual, Verifikasi QRIS & Tunai",
    email: "kasir@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "📦",
    label: "Staff Gudang",
    desc: "Akses Bahan Baku, Blind Stock Opname, Mutasi Stok & Supplier PO",
    email: "gudang@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "🍳",
    label: "Kitchen Display (KDS)",
    desc: "Layar Dapur Masak 3-Tahap: Baru → Mulai Masak → Siap Saji",
    email: "dapur@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "🍽️",
    label: "Pelayan (Antar)",
    desc: "Layar Antar Meja & Konfirmasi Pesanan Terantar (SERVED)",
    email: "pelayan@1621fnb.id",
    password: "Password1621!",
  },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("owner@1621fnb.id");
  const [password, setPassword] = React.useState("Password1621!");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function performLogin(targetEmail: string, targetPassword: string) {
    setErrorMessage(null);
    setEmail(targetEmail);
    setPassword(targetPassword);

    startTransition(async () => {
      const result = await loginStaffAction({
        email: targetEmail,
        password: targetPassword,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      if (result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    performLogin(email, password);
  }

  return (
    <div className="space-y-5">
      {/* Brand Header Inside Card (Persis Screenshot 1) */}
      <div className="flex flex-col items-center justify-center text-center pb-2">
        <div className="relative h-14 w-32 flex items-center justify-center mb-1">
          <Image
            src="/logo-1621.png"
            alt="Logo 1621F&B"
            width={128}
            height={56}
            className="h-full w-auto object-contain"
            priority
          />
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lattespaceboyolali@gmail.com"
            className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:ring-4 focus:ring-sky-500/10 outline-hidden transition-all"
          />
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700">
              Kata Sandi
            </label>
            <button
              type="button"
              onClick={() =>
                toast.info("Gunakan opsi Akun Demo di bawah atau hubungi Owner.")
              }
              className="text-xs font-semibold text-sky-600 hover:underline"
            >
              Lupa Kata Sandi?
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-4 py-3 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:ring-4 focus:ring-sky-500/10 outline-hidden transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 text-base"
              tabIndex={-1}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {/* Tombol Masuk Oranye Khas ESB POSLite */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-[#F58220] py-3 px-4 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition hover:bg-[#e07519] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {isPending ? "Sedang Memeriksa..." : "Masuk"}
        </button>
      </form>

      {/* Footer Info & Verification Links Sesuai Screenshot ESB */}
      <div className="pt-2 text-center space-y-1.5 text-2xs text-slate-400">
        <p>
          Cek email untuk verifikasi atau{" "}
          <button
            type="button"
            onClick={() => toast.success("Tautan verifikasi telah dikirim ulang.")}
            className="font-medium text-sky-600 hover:underline cursor-pointer"
          >
            Kirim ulang link verifikasi
          </button>
        </p>
        <p>
          Belum punya akun?{" "}
          <button
            type="button"
            onClick={() => setShowDemoDrawer(true)}
            className="font-bold text-[#F58220] hover:underline cursor-pointer"
          >
            Daftar Sekarang / Akun Demo
          </button>
        </p>
      </div>

      {/* Demo Quick Roles Toggle Button */}
      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowDemoDrawer(!showDemoDrawer)}
          className="flex items-center justify-between w-full py-1.5 px-2.5 text-2xs font-semibold text-slate-500 rounded-lg hover:bg-slate-50 transition cursor-pointer"
        >
          <span>🔑 Masuk Instan Akun Demo (5 Role F&amp;B)</span>
          <span>{showDemoDrawer ? "▲" : "▼"}</span>
        </button>

        {showDemoDrawer && (
          <div className="mt-2 space-y-1.5">
            {QUICK_ROLES.map((item) => (
              <button
                key={item.email}
                type="button"
                disabled={isPending}
                onClick={() => performLogin(item.email, item.password)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/50 p-2 text-left hover:border-sky-500 hover:bg-sky-50/60 transition cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-2xs font-bold text-slate-800">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.email}
                    </div>
                  </div>
                </div>
                <span className="text-2xs font-bold text-sky-600">
                  Masuk &rarr;
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
