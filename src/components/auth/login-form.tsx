"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginStaffAction } from "@/server/auth";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "forgot">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetSent, setResetSent] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [isSendingReset, setIsSendingReset] = React.useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const result = await loginStaffAction({
        email,
        password,
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

  async function handleSendResetEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = resetEmail.trim().toLowerCase();
    if (!trimmed) {
      setErrorMessage("Masukkan alamat email akun Anda.");
      return;
    }

    setIsSendingReset(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
      } else {
        setResetSent(true);
        toast.success(
          "Tautan reset kata sandi telah dikirim ke email Anda. Periksa inbox atau folder spam."
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal mengirim email reset kata sandi.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Kartu: Logo 1621 Group Besar (Tanpa Tulisan Sign In) */}
      <div className="flex flex-col items-center justify-center space-y-2 text-center">
        <div className="relative h-24 w-56 sm:h-28 sm:w-64 flex items-center justify-center">
          <Image
            src="/logo-1621group-stacked.png"
            alt="Logo 1621 Group"
            width={256}
            height={128}
            className="h-full w-auto object-contain"
            priority
          />
        </div>

        {mode === "forgot" && (
          <h1 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">
            Reset <span className="text-[#1E88E5]">Password</span>
          </h1>
        )}

        <div className="h-1 w-12 rounded-full bg-[#1E88E5]" />
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {mode === "login" ? (
        <>
          {/* Main Login Form (Input Pill Floating + Autofill Ready) */}
          <form onSubmit={handleSubmit} method="post" className="space-y-3.5">
            {/* Email Field */}
            <div className="group flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-[0_6px_20px_-8px_rgba(30,136,229,0.22)] transition focus-within:border-[#1E88E5] focus-within:ring-3 focus-within:ring-sky-500/15">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1E88E5]">
                <Mail className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="login-email" className="sr-only">
                  Alamat Email
                </label>
                <input
                  id="login-email"
                  name="username"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Alamat email"
                  className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="group flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-[0_6px_20px_-8px_rgba(30,136,229,0.22)] transition focus-within:border-[#1E88E5] focus-within:ring-3 focus-within:ring-sky-500/15">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1E88E5]">
                <Lock className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="login-password" className="sr-only">
                  Kata Sandi
                </label>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata sandi"
                  className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#1B5E86] hover:bg-sky-50 cursor-pointer transition"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setResetSent(false);
                  setResetEmail(email);
                  setMode("forgot");
                }}
                className="text-xs font-semibold text-[#1E88E5] hover:underline cursor-pointer"
              >
                Lupa Kata Sandi?
              </button>
            </div>

            {/* Tombol Masuk Utama Dominan Biru */}
            <button
              type="submit"
              disabled={isPending}
              className="relative flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#0284C7] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(30,136,229,0.55)] transition hover:from-[#1976D2] hover:to-[#0369A1] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <span>{isPending ? "Sedang Memeriksa..." : "Masuk"}</span>
              <ArrowRight className="absolute right-5 h-4 w-4" />
            </button>
          </form>

          <p className="pt-1 text-center text-[11px] text-slate-400">
            Staf dapat mereset kata sandi sendiri melalui menu Lupa Kata Sandi.
          </p>
        </>
      ) : (
        <form onSubmit={handleSendResetEmail} className="space-y-3.5">
          {resetSent ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Email reset kata sandi terkirim!
              </p>
              <p>
                Buka email <strong>{resetEmail}</strong> dan klik tautan di
                dalamnya untuk membuat kata sandi baru.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Masukkan email akun staf Anda untuk menerima link pengaturan ulang
              kata sandi.
            </p>
          )}

          <div className="group flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-[0_6px_20px_-8px_rgba(30,136,229,0.22)] transition focus-within:border-[#1E88E5] focus-within:ring-3 focus-within:ring-sky-500/15">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1E88E5]">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="reset-email" className="sr-only">
                Email Akun Staf
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Masukkan alamat email staf"
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSendingReset}
            className="relative flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#0284C7] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(30,136,229,0.55)] transition hover:from-[#1976D2] hover:to-[#0369A1] disabled:opacity-60 cursor-pointer"
          >
            <span>
              {isSendingReset
                ? "Mengirim Link..."
                : "Kirim Link Reset Password"}
            </span>
            <ArrowRight className="absolute right-5 h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setMode("login");
            }}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Sign In</span>
          </button>
        </form>
      )}
    </div>
  );
}
