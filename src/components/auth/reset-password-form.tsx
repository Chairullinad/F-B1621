"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordSelfPasswordResetAuditAction } from "@/server/auth";

export function ResetPasswordForm({
  initialError,
}: {
  initialError?: string;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    initialError ?? null
  );
  const [done, setDone] = React.useState(false);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);
  const [hasRecoverySession, setHasRecoverySession] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const supabase = createSupabaseBrowserClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error && active) {
            setErrorMessage(
              "Link reset kata sandi sudah kedaluwarsa atau tidak valid. Silakan minta link baru."
            );
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (active) {
          setHasRecoverySession(Boolean(session));
        }
      } catch {
        if (active) {
          setErrorMessage("Gagal memverifikasi sesi reset kata sandi.");
        }
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    }
    void checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
        return;
      }

      const auditRes = await recordSelfPasswordResetAuditAction();
      setDone(true);
      toast.success("Kata sandi baru berhasil disimpan.");

      const target = auditRes.redirectTo ?? "/login";
      setTimeout(() => {
        router.push(target);
        router.refresh();
      }, 1200);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal memperbarui kata sandi.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-left">
        <div className="relative h-12 w-32 flex items-center justify-start">
          <Image
            src="/logo-1621group-stacked.png"
            alt="Logo 1621 Group"
            width={128}
            height={64}
            className="h-full w-auto object-contain object-left"
            priority
          />
        </div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
          Buat <span className="text-[#1E88E5]">Password Baru</span>
        </h1>
        <div className="h-1 w-9 rounded-full bg-[#1E88E5]" />
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {done ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-2">
          <p className="font-bold flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Kata sandi berhasil diperbarui!
          </p>
          <p>Mengalihkan ke aplikasi...</p>
        </div>
      ) : isCheckingSession ? (
        <p className="py-6 text-center text-xs text-slate-500">
          Memverifikasi tautan reset kata sandi...
        </p>
      ) : !hasRecoverySession ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Tautan reset kata sandi tidak ditemukan atau sudah kedaluwarsa.
            Silakan kembali ke halaman Sign In dan minta link reset baru.
          </p>
          <Link
            href="/login"
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#0284C7] px-5 py-3 text-sm font-bold text-white"
          >
            Kembali ke Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} method="post" className="space-y-3.5">
          <div className="group flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-[0_6px_20px_-8px_rgba(30,136,229,0.22)] transition focus-within:border-[#1E88E5] focus-within:ring-3 focus-within:ring-sky-500/15">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1E88E5]">
              <Lock className="h-4 w-4" />
            </span>
            <input
              id="new-password"
              name="new-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Kata sandi baru (min. 8 karakter)"
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#1B5E86] hover:bg-sky-50 cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="group flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-[0_6px_20px_-8px_rgba(30,136,229,0.22)] transition focus-within:border-[#1E88E5] focus-within:ring-3 focus-within:ring-sky-500/15">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1E88E5]">
              <Lock className="h-4 w-4" />
            </span>
            <input
              id="confirm-password"
              name="confirm-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="relative flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#0284C7] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(30,136,229,0.55)] transition hover:from-[#1976D2] hover:to-[#0369A1] disabled:opacity-60 cursor-pointer"
          >
            <span>
              {isSubmitting ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
            </span>
            <ArrowRight className="absolute right-5 h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
