"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginStaffAction } from "@/server/auth";

const QUICK_ROLES = [
  {
    icon: "👑",
    label: "Owner",
    desc: "Dashboard, laporan keuangan 5 tab, inventory, audit & semua modul",
    email: "owner@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "🧑‍🍳",
    label: "Kasir",
    desc: "POS manual, verifikasi QRIS & Tunai meja, cek stok & transfer",
    email: "kasir@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "📦",
    label: "Staff Gudang",
    desc: "Inventory bahan baku, blind stock opname, transfer, waste & PO",
    email: "gudang@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "🍳",
    label: "Kitchen Display (Dapur)",
    desc: "Antrian masak 3 tahap: Baru → Mulai Masak → Siap Saji",
    email: "dapur@1621fnb.id",
    password: "Password1621!",
  },
  {
    icon: "🍽️",
    label: "Pelayan (Antar Meja)",
    desc: "Antar pesanan siap ke meja pelanggan (SERVED)",
    email: "pelayan@1621fnb.id",
    password: "Password1621!",
  },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
      {/* Quick Role Login Buttons */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Pilih Role Cepat (Klik Langsung Masuk)
        </p>
        <div className="grid gap-2">
          {QUICK_ROLES.map((item) => (
            <button
              key={item.email}
              type="button"
              disabled={isPending}
              onClick={() => performLogin(item.email, item.password)}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-left transition-all hover:border-blue-600 hover:bg-blue-50/70 disabled:opacity-60"
            >
              <span className="text-xl">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">
                  {item.label}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {item.desc}
                </div>
              </div>
              <span className="text-xs font-semibold text-blue-600">Masuk →</span>
            </button>
          ))}

          <Link
            href="/m/6b97cfd477e80fa2bb78e4ee387751c0b3cf7e09f7b88675"
            className="flex w-full items-center gap-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/80 px-3.5 py-2.5 text-left transition-all hover:bg-emerald-100/80"
          >
            <span className="text-xl">🙋</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-emerald-950">
                Customer (Order Online QR Meja 1)
              </div>
              <div className="truncate text-xs text-emerald-700">
                Pesan dari meja via QRIS dinamis atau bayar tunai di kasir
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-700">
              Buka →
            </span>
          </Link>
        </div>
      </div>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-slate-200" />
        <span className="mx-3 flex-shrink text-xs text-slate-400">
          atau login manual dengan email
        </span>
        <div className="flex-grow border-t border-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-700"
          >
            Email Staf
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="owner@1621fnb.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-700"
          >
            Kata Sandi
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          size="lg"
          disabled={isPending}
        >
          {isPending ? "Memverifikasi Akun..." : "Masuk ke f&b1621"}
        </Button>
      </form>
    </div>
  );
}
