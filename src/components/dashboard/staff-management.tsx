"use client";

import * as React from "react";
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS_ID } from "@/lib/auth";
import type { UserRole } from "@/lib/types/database";
import {
  createStaffUserAction,
  resetStaffPasswordAction,
  toggleStaffActiveAction,
  updateStaffMemberAction,
  type StaffMemberWithEmail,
} from "@/server/auth";
import type { OutletView } from "@/server/outlets";

const ROLES: ReadonlyArray<UserRole> = [
  "owner",
  "cashier",
  "warehouse",
  "kitchen",
  "waiter",
];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner:
    "Akses penuh ke semua cabang, Dashboard, Pembukuan, Pengaturan Pajak/QRIS, Approve Opname, Batal SERVED, & Manajemen User.",
  cashier:
    "Akses Layar Kasir/Kitchen/Antar, POS Order Manual, Verifikasi QRIS/Tunai, Revisi, Rebilling Menu Habis, Diskon, Cetak Struk, & Bahan Baku.",
  warehouse:
    "Akses Bahan Baku & Resep BOM, Stock Opname (Blind Count), Transfer Stok Antar Cabang, Waste Tracking, & Supplier PO.",
  kitchen:
    "Akses khusus Layar Kitchen (KDS 3-Tahap: Antrean Baru -> Mulai Masak -> Siap Saji) tanpa melihat harga/uang.",
  waiter:
    "Akses khusus Layar Antar Meja untuk mengambil pesanan Siap Saji (READY) dari Kitchen dan mengantar ke meja pelanggan.",
};

interface PermissionMatrixRow {
  module: string;
  feature: string;
  owner: string | boolean;
  cashier: string | boolean;
  warehouse: string | boolean;
  kitchen: string | boolean;
  waiter: string | boolean;
}

const PERMISSION_MATRIX: ReadonlyArray<PermissionMatrixRow> = [
  {
    module: "Beranda & Keuangan",
    feature: "Dashboard Eksekutif & Grafik Penjualan",
    owner: true,
    cashier: false,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Beranda & Keuangan",
    feature: "Pembukuan 5 Tab (Jurnal, Laba Rugi, Neraca, Arus Kas, Pajak)",
    owner: true,
    cashier: false,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kasir & Pesanan",
    feature: "Layar Kasir (Verifikasi QRIS Meja & Terima Tunai)",
    owner: true,
    cashier: true,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kasir & Pesanan",
    feature: "POS / Order Manual & Cetak Struk (+ Tiket Kitchen)",
    owner: true,
    cashier: true,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kasir & Pesanan",
    feature: "Revisi Pesanan & Mekanisme Rebilling (Menu Habis)",
    owner: true,
    cashier: true,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kasir & Pesanan",
    feature: "Pemberian Diskon Kasir",
    owner: "Tanpa Batas",
    cashier: "Sesuai Batas Outlet",
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kasir & Pesanan",
    feature: "Pembatalan Order PAID (Sebelum Disajikan + Refund)",
    owner: true,
    cashier: true,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kasir & Pesanan",
    feature: "Pembatalan Order SERVED (Sudah Disajikan ke Meja)",
    owner: "Hanya Kesalahan Outlet",
    cashier: false,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Kitchen & Antar",
    feature: "Layar Kitchen (KDS: Mulai Masak & Siap Saji)",
    owner: true,
    cashier: true,
    warehouse: false,
    kitchen: true,
    waiter: false,
  },
  {
    module: "Kitchen & Antar",
    feature: "Layar Antar Meja (Tandai Sudah Diantar / SERVED)",
    owner: true,
    cashier: true,
    warehouse: false,
    kitchen: false,
    waiter: true,
  },
  {
    module: "Menu & Kedai",
    feature: "Kelola Menu, Kategori, Cabang, Meja QR, Pajak & Upload QRIS",
    owner: true,
    cashier: false,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Inventori & Gudang",
    feature: "Bahan Baku, Resep (BOM) & Transfer Stok Antar Cabang",
    owner: true,
    cashier: true,
    warehouse: true,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Inventori & Gudang",
    feature: "Stock Opname (Input Blind Count vs Approval Selisih)",
    owner: "Input & Approve",
    cashier: false,
    warehouse: "Input Blind Count",
    kitchen: false,
    waiter: false,
  },
  {
    module: "Inventori & Gudang",
    feature: "Waste Tracking (Barang Rusak) & Supplier PO",
    owner: true,
    cashier: false,
    warehouse: true,
    kitchen: false,
    waiter: false,
  },
  {
    module: "Akses & Keamanan",
    feature: "Manajemen User, Reset Password & Jejak Audit Hash",
    owner: true,
    cashier: false,
    warehouse: false,
    kitchen: false,
    waiter: false,
  },
];

export function StaffManagement({
  initialStaff,
  currentOwnerId,
  outlets,
  defaultOutletId,
}: {
  initialStaff: ReadonlyArray<StaffMemberWithEmail>;
  currentOwnerId: string;
  outlets: ReadonlyArray<OutletView>;
  defaultOutletId: string;
}) {
  const [activeTab, setActiveTab] = React.useState<"users" | "permissions">(
    "users"
  );
  const [filterOutletId, setFilterOutletId] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // State form tambah user baru
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("cashier");
  const [outletId, setOutletId] = React.useState<string>(defaultOutletId);

  // State modal edit nama / reset password
  const [editingMember, setEditingMember] =
    React.useState<StaffMemberWithEmail | null>(null);
  const [editFullName, setEditFullName] = React.useState("");
  const [editRole, setEditRole] = React.useState<UserRole>("cashier");
  const [editOutletId, setEditOutletId] = React.useState<string>(defaultOutletId);

  const [resettingMember, setResettingMember] =
    React.useState<StaffMemberWithEmail | null>(null);
  const [newPassword, setNewPassword] = React.useState("");

  const [isPending, startTransition] = React.useTransition();

  const filteredStaff = React.useMemo(() => {
    return initialStaff.filter((member) => {
      if (filterOutletId !== "ALL" && member.outlet_id !== filterOutletId) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = member.full_name.toLowerCase().includes(q);
        const matchEmail = member.email.toLowerCase().includes(q);
        const matchRole = ROLE_LABELS_ID[member.role]
          .toLowerCase()
          .includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      return true;
    });
  }, [initialStaff, filterOutletId, searchQuery]);

  function handleCreateStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createStaffUserAction({
        fullName,
        email,
        password,
        role,
        outletId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("cashier");
    });
  }

  function handleQuickUpdateMember(
    member: StaffMemberWithEmail,
    nextRole: UserRole,
    nextOutletId: string
  ) {
    startTransition(async () => {
      const res = await updateStaffMemberAction({
        profileId: member.id,
        fullName: member.full_name,
        role: nextRole,
        outletId: nextOutletId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  function handleSaveEditMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingMember) return;
    startTransition(async () => {
      const res = await updateStaffMemberAction({
        profileId: editingMember.id,
        fullName: editFullName,
        role: editRole,
        outletId: editOutletId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setEditingMember(null);
    });
  }

  function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resettingMember) return;
    startTransition(async () => {
      const res = await resetStaffPasswordAction({
        profileId: resettingMember.id,
        newPassword,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setResettingMember(null);
      setNewPassword("");
    });
  }

  function handleToggleActive(profileId: string, nextActive: boolean) {
    startTransition(async () => {
      const res = await toggleStaffActiveAction({
        profileId,
        isActive: nextActive,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  function renderPermissionCell(val: string | boolean) {
    if (val === true) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Diizinkan
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <XCircle className="h-3.5 w-3.5" />
          Tidak
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#1B5E86]">
        {val}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bar Navigasi 2 Tab: Daftar User & Cabang vs Matriks Hak Akses */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-[#1B5E86] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Daftar User &amp; Penugasan Cabang ({initialStaff.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "permissions"
                ? "bg-[#1B5E86] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Matriks Hak Akses &amp; Izin Role</span>
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* TAB 1: DAFTAR USER, TAMBAH STAF, PINDAH CABANG & RESET PASSWORD    */}
      {/* ================================================================== */}
      {activeTab === "users" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Kolom Kiri: Form Tambah User Baru */}
          <Card className="lg:col-span-4 border-slate-200 shadow-2xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-[#1E88E5]" />
                Tambah Akun User / Staf Baru
              </CardTitle>
              <CardDescription>
                Buat akun login staf baru, pilih jabatan (hak akses), dan
                tentukan cabang tempat staf bertugas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStaff} className="space-y-3.5">
                <div className="space-y-1">
                  <label
                    htmlFor="staff-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nama Lengkap Staf
                  </label>
                  <Input
                    id="staff-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="staff-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email Login
                  </label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kasir.lattespace@1621.id"
                    required
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="staff-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password Awal
                  </label>
                  <Input
                    id="staff-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    minLength={8}
                    required
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="staff-outlet"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Cabang Penugasan
                  </label>
                  <select
                    id="staff-outlet"
                    value={outletId}
                    onChange={(e) => setOutletId(e.target.value)}
                    disabled={isPending}
                    className="flex min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {outlets.map((out) => (
                      <option key={out.id} value={out.id}>
                        {out.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="staff-role"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Role / Hak Akses
                  </label>
                  <select
                    id="staff-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={isPending}
                    className="flex min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS_ID[r]} ({r})
                      </option>
                    ))}
                  </select>
                  <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Menyimpan..." : "Buat Akun User Sekarang"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Kolom Kanan: Daftar User Lintas Cabang + Edit & Reset Password */}
          <Card className="lg:col-span-8 border-slate-200 shadow-2xs">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Daftar User Aktif &amp; Pengaturan Akses (
                    {filteredStaff.length} Akun)
                  </CardTitle>
                  <CardDescription>
                    Ubah Role, pindahkan cabang tugas, atau reset kata sandi
                    staf kapan saja. Semua perubahan tercatat di Jejak Audit.
                  </CardDescription>
                </div>
              </div>

              {/* Filter Cabang & Pencarian */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterOutletId("ALL")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      filterOutletId === "ALL"
                        ? "bg-[#1B5E86] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Semua Cabang ({initialStaff.length})
                  </button>
                  {outlets.map((out) => {
                    const count = initialStaff.filter(
                      (s) => s.outlet_id === out.id
                    ).length;
                    return (
                      <button
                        key={out.id}
                        type="button"
                        onClick={() => setFilterOutletId(out.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          filterOutletId === out.id
                            ? "bg-[#1B5E86] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {out.name} ({count})
                      </button>
                    );
                  })}
                </div>

                <Input
                  type="search"
                  placeholder="Cari nama / email / role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56"
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Form Inline Edit Profil User */}
              {editingMember && (
                <form
                  onSubmit={handleSaveEditMember}
                  className="rounded-xl border-2 border-sky-300 bg-sky-50/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">
                      Edit User: {editingMember.full_name} (
                      {editingMember.email})
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingMember(null)}
                    >
                      Batal
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Nama Lengkap
                      </label>
                      <Input
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Cabang Tugas
                      </label>
                      <select
                        value={editOutletId}
                        onChange={(e) => setEditOutletId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                      >
                        {outlets.map((out) => (
                          <option key={out.id} value={out.id}>
                            {out.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Role / Hak Akses
                      </label>
                      <select
                        value={editRole}
                        disabled={editingMember.id === currentOwnerId}
                        onChange={(e) =>
                          setEditRole(e.target.value as UserRole)
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS_ID[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="submit" size="sm" disabled={isPending}>
                      Simpan Perubahan User
                    </Button>
                  </div>
                </form>
              )}

              {/* Form Inline Reset Password Staf */}
              {resettingMember && (
                <form
                  onSubmit={handleResetPassword}
                  className="rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">
                      Reset Password untuk {resettingMember.full_name} (
                      {resettingMember.email})
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResettingMember(null);
                        setNewPassword("");
                      }}
                    >
                      Batal
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="password"
                      placeholder="Masukkan password baru (minimal 8 karakter)..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      className="flex-1 bg-white"
                    />
                    <Button type="submit" size="sm" disabled={isPending}>
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                      Simpan Password Baru
                    </Button>
                  </div>
                </form>
              )}

              {/* Daftar Baris Staf */}
              {filteredStaff.map((member) => {
                const isSelf = member.id === currentOwnerId;
                return (
                  <div
                    key={member.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs xl:flex-row xl:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {member.full_name}
                        </span>
                        <Badge
                          variant={member.is_active ? "success" : "destructive"}
                        >
                          {member.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#EBF5FF] px-2 py-0.5 text-[11px] font-bold text-[#1B5E86]">
                          <Store className="h-3 w-3" />
                          {member.outletName ?? "LATTESPACE"}
                        </span>
                        {isSelf ? <Badge variant="outline">Akun Anda</Badge> : null}
                      </div>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Dropdown Pindah Cabang */}
                      <select
                        aria-label={`Cabang tugas ${member.full_name}`}
                        value={member.outlet_id}
                        onChange={(e) =>
                          handleQuickUpdateMember(
                            member,
                            member.role,
                            e.target.value
                          )
                        }
                        disabled={isPending}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
                      >
                        {outlets.map((out) => (
                          <option key={out.id} value={out.id}>
                            Cabang: {out.name}
                          </option>
                        ))}
                      </select>

                      {/* Dropdown Ubah Role / Hak Akses */}
                      <select
                        aria-label={`Ubah role ${member.full_name}`}
                        value={member.role}
                        onChange={(e) =>
                          handleQuickUpdateMember(
                            member,
                            e.target.value as UserRole,
                            member.outlet_id
                          )
                        }
                        disabled={isPending || isSelf}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#1B5E86]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            Role: {ROLE_LABELS_ID[r]}
                          </option>
                        ))}
                      </select>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          setEditingMember(member);
                          setEditFullName(member.full_name);
                          setEditRole(member.role);
                          setEditOutletId(member.outlet_id);
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          setResettingMember(member);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                        Password
                      </Button>

                      <Button
                        type="button"
                        variant={member.is_active ? "ghost" : "default"}
                        size="sm"
                        disabled={isPending || isSelf}
                        onClick={() =>
                          handleToggleActive(member.id, !member.is_active)
                        }
                      >
                        {member.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: MATRIKS HAK AKSES & IZIN OPERASIONAL PER ROLE               */}
      {/* ================================================================== */}
      {activeTab === "permissions" && (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-[#1E88E5]" />
              Matriks Hak Akses &amp; Izin Operasional (RBAC 1621 Group)
            </CardTitle>
            <CardDescription>
              Setiap akun user yang Anda beri Role di tab{" "}
              <strong>Daftar User</strong> otomatis mewarisi hak akses dan
              batasan keamanan di bawah ini (ditegakkan di level Server &amp;
              Row Level Security Database).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-bold">Modul</th>
                    <th className="px-4 py-3 font-bold">
                      Fitur / Tindakan Operasional
                    </th>
                    <th className="px-3 py-3 text-center font-bold">Owner</th>
                    <th className="px-3 py-3 text-center font-bold">Kasir</th>
                    <th className="px-3 py-3 text-center font-bold">
                      Staff Gudang
                    </th>
                    <th className="px-3 py-3 text-center font-bold">Kitchen</th>
                    <th className="px-3 py-3 text-center font-bold">Pelayan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {PERMISSION_MATRIX.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {row.module}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.feature}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {renderPermissionCell(row.owner)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {renderPermissionCell(row.cashier)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {renderPermissionCell(row.warehouse)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {renderPermissionCell(row.kitchen)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {renderPermissionCell(row.waiter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
