"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDefaultRouteForRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow, UserRole } from "@/lib/types/database";

const userRoleSchema = z.enum(["owner", "cashier", "kitchen", "waiter"]);

const loginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid."),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
});

const createStaffInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(100, "Nama lengkap terlalu panjang."),
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid."),
  password: z.string().min(8, "Kata sandi awal minimal 8 karakter."),
  role: userRoleSchema,
});

const updateStaffRoleInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  role: userRoleSchema,
});

const toggleStaffActiveInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  isActive: z.boolean(),
});

export interface AuthenticatedStaff {
  userId: string;
  email: string;
  outletId: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface StaffMemberWithEmail extends ProfileRow {
  email: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  redirectTo?: string;
}

async function getRequestAuditMeta(): Promise<{ ip: string; device: string }> {
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "unknown";
  return { ip, device };
}

async function recordAuthAuditLog(params: {
  outletId: string | null;
  userId: string | null;
  role: string;
  action: "auth.login_success" | "auth.login_failed" | "auth.logout";
  entityId: string;
  after?: Record<string, string | boolean | null>;
  reason?: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { ip, device } = await getRequestAuditMeta();
    await admin.from("audit_logs").insert({
      outlet_id: params.outletId,
      user_id: params.userId,
      role: params.role,
      device,
      ip,
      action: params.action,
      entity: "auth",
      entity_id: params.entityId,
      before: null,
      after: params.after ?? null,
      reason: params.reason ?? null,
      prev_hash: "",
      hash: "",
    });
  } catch {
    // Jangan gagalkan respons login jika tabel belum dimigrasi di lingkungan baru
  }
}

/**
 * Mengambil sesi staf aktif saat ini beserta profil dari tabel public.profiles.
 * Mengembalikan null jika belum login atau akun nonaktif/dihapus.
 */
export async function getCurrentStaffSession(): Promise<AuthenticatedStaff | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return null;
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, outlet_id, full_name, role, is_active, deleted_at")
      .eq("id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (profileErr || !profile || !profile.is_active) {
      return null;
    }

    return {
      userId: profile.id,
      email: user.email ?? "",
      outletId: profile.outlet_id,
      fullName: profile.full_name,
      role: profile.role as UserRole,
      isActive: profile.is_active,
    };
  } catch {
    return null;
  }
}

/**
 * Memastikan pemanggil adalah staf aktif dengan role yang diizinkan.
 * Mengalihkan ke /login jika belum login, atau ke halaman default rolenya jika tidak berhak.
 */
export async function requireStaffRole(
  allowedRoles?: ReadonlyArray<UserRole>
): Promise<AuthenticatedStaff> {
  const staff = await getCurrentStaffSession();
  if (!staff) {
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    redirect(getDefaultRouteForRole(staff.role));
  }

  return staff;
}

/**
 * Server Action: Login staf menggunakan email & kata sandi.
 */
export async function loginStaffAction(
  rawInput: { email: string; password: string }
): Promise<ActionResult> {
  const parsed = loginInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Input tidak valid.";
    return { ok: false, message: firstIssue };
  }

  const { email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: signInData, error: signInErr } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInErr || !signInData.user) {
    await recordAuthAuditLog({
      outletId: null,
      userId: null,
      role: "unauthenticated",
      action: "auth.login_failed",
      entityId: email.toLowerCase(),
      after: { email: email.toLowerCase() },
      reason: signInErr?.message ?? "Email atau kata sandi salah",
    });

    return {
      ok: false,
      message: "Email atau kata sandi salah. Silakan periksa kembali.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, outlet_id, full_name, role, is_active, deleted_at")
    .eq("id", signInData.user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.deleted_at !== null) {
    await supabase.auth.signOut();
    await recordAuthAuditLog({
      outletId: null,
      userId: signInData.user.id,
      role: "unassigned",
      action: "auth.login_failed",
      entityId: signInData.user.id,
      after: { email: email.toLowerCase() },
      reason: "Profil staf tidak ditemukan",
    });

    return {
      ok: false,
      message: "Akun Anda belum terdaftar sebagai staf aktif di outlet ini.",
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    await recordAuthAuditLog({
      outletId: profile.outlet_id,
      userId: profile.id,
      role: profile.role,
      action: "auth.login_failed",
      entityId: profile.id,
      after: { email: email.toLowerCase(), is_active: false },
      reason: "Akun staf nonaktif",
    });

    return {
      ok: false,
      message: "Akun Anda sedang dinonaktifkan. Hubungi Owner.",
    };
  }

  const role = profile.role as UserRole;
  const targetRoute = getDefaultRouteForRole(role);

  await recordAuthAuditLog({
    outletId: profile.outlet_id,
    userId: profile.id,
    role,
    action: "auth.login_success",
    entityId: profile.id,
    after: {
      email: email.toLowerCase(),
      full_name: profile.full_name,
      role,
    },
  });

  return {
    ok: true,
    message: `Selamat datang, ${profile.full_name}.`,
    redirectTo: targetRoute,
  };
}

/**
 * Server Action: Logout staf dan catat ke audit_logs.
 */
export async function logoutStaffAction(): Promise<void> {
  const staff = await getCurrentStaffSession();
  const supabase = await createSupabaseServerClient();

  if (staff) {
    await recordAuthAuditLog({
      outletId: staff.outletId,
      userId: staff.userId,
      role: staff.role,
      action: "auth.logout",
      entityId: staff.userId,
      after: { email: staff.email, full_name: staff.fullName },
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Ambil seluruh daftar staf untuk Owner di halaman /dashboard/staf.
 */
export async function listStaffMembersForOwner(): Promise<
  StaffMemberWithEmail[]
> {
  const owner = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const [{ data: profiles, error: profErr }, { data: usersData }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("*")
        .eq("outlet_id", owner.outletId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      admin.auth.admin.listUsers({ perPage: 200 }),
    ]);

  if (profErr || !profiles) {
    return [];
  }

  const emailMap = new Map<string, string>();
  for (const u of usersData?.users ?? []) {
    emailMap.set(u.id, u.email ?? "-");
  }

  return (profiles as ProfileRow[]).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "-",
  }));
}

/**
 * Server Action (Khusus Owner): Tambah akun staf baru.
 */
export async function createStaffUserAction(rawInput: {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"]);
  const parsed = createStaffInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data staf tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { fullName, email, password, role } = parsed.data;

  const { data: createdUser, error: createAuthErr } =
    await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

  if (createAuthErr || !createdUser.user) {
    return {
      ok: false,
      message:
        createAuthErr?.message ??
        "Gagal membuat akun autentikasi staf. Pastikan email belum dipakai.",
    };
  }

  const { ip, device } = await getRequestAuditMeta();
  await admin.rpc("set_audit_context", {
    p_user_id: owner.userId,
    p_role: owner.role,
    p_device: device,
    p_ip: ip,
    p_reason: `Pembuatan staf baru (${role}) oleh Owner`,
  });

  const { error: insertProfErr } = await admin.from("profiles").insert({
    id: createdUser.user.id,
    outlet_id: owner.outletId,
    full_name: fullName,
    role,
    is_active: true,
  });

  if (insertProfErr) {
    return {
      ok: false,
      message: `Gagal menyimpan profil staf: ${insertProfErr.message}`,
    };
  }

  revalidatePath("/dashboard/staf");
  return {
    ok: true,
    message: `Akun staf ${fullName} (${email}) berhasil ditambahkan.`,
  };
}

/**
 * Server Action (Khusus Owner): Ubah role staf.
 */
export async function updateStaffRoleAction(rawInput: {
  profileId: string;
  role: UserRole;
}): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"]);
  const parsed = updateStaffRoleInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }

  const { profileId, role } = parsed.data;
  if (profileId === owner.userId && role !== "owner") {
    return {
      ok: false,
      message: "Owner tidak dapat menurunkan role miliknya sendiri.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { ip, device } = await getRequestAuditMeta();
  await admin.rpc("set_audit_context", {
    p_user_id: owner.userId,
    p_role: owner.role,
    p_device: device,
    p_ip: ip,
    p_reason: `Perubahan role staf menjadi ${role}`,
  });

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", profileId)
    .eq("outlet_id", owner.outletId);

  if (error) {
    return { ok: false, message: `Gagal mengubah role: ${error.message}` };
  }

  revalidatePath("/dashboard/staf");
  return { ok: true, message: "Role staf berhasil diperbarui." };
}

/**
 * Server Action (Khusus Owner): Aktifkan / nonaktifkan akun staf.
 */
export async function toggleStaffActiveAction(rawInput: {
  profileId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"]);
  const parsed = toggleStaffActiveInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }

  const { profileId, isActive } = parsed.data;
  if (profileId === owner.userId && !isActive) {
    return {
      ok: false,
      message: "Anda tidak dapat menonaktifkan akun Owner Anda sendiri.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { ip, device } = await getRequestAuditMeta();
  await admin.rpc("set_audit_context", {
    p_user_id: owner.userId,
    p_role: owner.role,
    p_device: device,
    p_ip: ip,
    p_reason: isActive
      ? "Pengaktifan kembali akun staf"
      : "Penonaktifan akun staf",
  });

  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .eq("outlet_id", owner.outletId);

  if (error) {
    return {
      ok: false,
      message: `Gagal memperbarui status staf: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/staf");
  return {
    ok: true,
    message: isActive
      ? "Akun staf berhasil diaktifkan."
      : "Akun staf berhasil dinonaktifkan.",
  };
}
