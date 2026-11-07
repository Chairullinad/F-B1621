"use client";

import * as React from "react";
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
  toggleStaffActiveAction,
  updateStaffRoleAction,
  type StaffMemberWithEmail,
} from "@/server/auth";

const ROLES: ReadonlyArray<UserRole> = [
  "owner",
  "cashier",
  "kitchen",
  "waiter",
];

export function StaffManagement({
  initialStaff,
  currentOwnerId,
}: {
  initialStaff: ReadonlyArray<StaffMemberWithEmail>;
  currentOwnerId: string;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("cashier");
  const [isPending, startTransition] = React.useTransition();

  function handleCreateStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createStaffUserAction({
        fullName,
        email,
        password,
        role,
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

  function handleRoleChange(profileId: string, newRole: UserRole) {
    startTransition(async () => {
      const res = await updateStaffRoleAction({ profileId, role: newRole });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
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

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Tambah Akun Staf Baru</CardTitle>
          <CardDescription>
            Buat akun login staf sesuai tugasnya (Owner, Kasir, Dapur, atau
            Pelayan).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="staff-name" className="block text-sm font-medium">
                Nama Lengkap
              </label>
              <Input
                id="staff-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="contoh: Budi Santoso"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="staff-email"
                className="block text-sm font-medium"
              >
                Email Login
              </label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kasir2@1621fnb.id"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="staff-password"
                className="block text-sm font-medium"
              >
                Kata Sandi Awal
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

            <div className="space-y-1.5">
              <label htmlFor="staff-role" className="block text-sm font-medium">
                Role
              </label>
              <select
                id="staff-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={isPending}
                className="flex min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS_ID[r]} ({r})
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Tambah Staf"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Staf ({initialStaff.length} Akun)
          </CardTitle>
          <CardDescription>
            Semua perubahan role atau status aktif staf dicatat otomatis di
            Jejak Audit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialStaff.map((member) => {
            const isSelf = member.id === currentOwnerId;
            return (
              <div
                key={member.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{member.full_name}</span>
                    <Badge
                      variant={member.is_active ? "success" : "destructive"}
                    >
                      {member.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                    {isSelf ? <Badge variant="outline">Anda</Badge> : null}
                  </div>
                  <p className="text-sm text-zinc-600">{member.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Ubah role ${member.full_name}`}
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.id, e.target.value as UserRole)
                    }
                    disabled={isPending || isSelf}
                    className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS_ID[r]}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant={member.is_active ? "outline" : "default"}
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
  );
}
