"use server";

import { cache } from "react";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ALL_PERMISSION_KEYS,
  getDefaultRouteForUser,
  hasUserPermission,
  ROLE_DEFAULT_PERMISSIONS,
  sanitizeCustomPermissions,
} from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PermissionKey,
  ProfileRow,
  UserCustomPermissions,
  UserRole,
} from "@/lib/types/database";

const userRoleSchema = z.enum(["owner", "cashier", "warehouse", "kitchen", "waiter"]);

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
  outletId: z.string().uuid().optional(),
});

const updateStaffRoleInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  role: userRoleSchema,
});

const updateStaffMemberInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  role: userRoleSchema,
  outletId: z.string().uuid("Cabang penugasan tidak valid."),
});

const resetStaffPasswordInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  newPassword: z
    .string()
    .min(8, "Kata sandi baru minimal 8 karakter.")
    .max(100),
});

const toggleStaffActiveInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  isActive: z.boolean(),
});

export interface AuthenticatedStaff {
  userId: string;
  email: string;
  outletId: string;
  selectedOutletId: string | null;
  fullName: string;
  role: UserRole;
  customPermissions: UserCustomPermissions | null;
  isActive: boolean;
}

export interface StaffMemberWithEmail extends ProfileRow {
  email: string;
  outletName?: string;
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

interface CachedStaffProfileRecord {
  id: string;
  outlet_id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  deleted_at: string | null;
  custom_permissions?: unknown;
}

const getCachedStaffProfileById = unstable_cache(
  async (userId: string): Promise<CachedStaffProfileRecord | null> => {
    const admin = createSupabaseAdminClient();
    const firstRes = await admin
      .from("profiles")
      .select(
        "id, outlet_id, full_name, role, is_active, deleted_at, custom_permissions"
      )
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (
      firstRes.error &&
      firstRes.error.message.includes("custom_permissions")
    ) {
      const fallbackRes = await admin
        .from("profiles")
        .select("id, outlet_id, full_name, role, is_active, deleted_at")
        .eq("id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (fallbackRes.error || !fallbackRes.data) return null;
      return fallbackRes.data;
    }

    if (firstRes.error || !firstRes.data) return null;
    return firstRes.data;
  },
  ["staff_profile_by_id"],
  { revalidate: 30, tags: ["staff_profiles"] }
);

const getCachedActiveOutletExists = unstable_cache(
  async (outletId: string): Promise<string | null> => {
    const admin = createSupabaseAdminClient();
    const { data: out } = await admin
      .from("outlets")
      .select("id")
      .eq("id", outletId)
      .is("deleted_at", null)
      .maybeSingle();
    return out ? String(out.id) : null;
  },
  ["staff_active_outlet_exists"],
  { revalidate: 60, tags: ["sidebar_outlets"] }
);

/**
 * Mengambil sesi staf aktif saat ini beserta profil dari tabel public.profiles.
 * Dibungkus React `cache()` + `unstable_cache` untuk profil & validasi outlet agar perpindahan halaman super cepat.
 * Mengembalikan null jika belum login atau akun nonaktif/dihapus.
 */
const loadCurrentStaffSessionCached = cache(
  async (): Promise<AuthenticatedStaff | null> => {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: claimsData,
        error: claimsErr,
      } = await supabase.auth.getClaims();

      const userId = !claimsErr ? claimsData?.claims?.sub : undefined;
      if (!userId) {
        return null;
      }

      const userEmail =
        typeof claimsData?.claims?.email === "string"
          ? claimsData.claims.email
          : "";

      const profile = await getCachedStaffProfileById(userId);

      if (!profile || !profile.is_active) {
        return null;
      }

      const role = profile.role as UserRole;
      const customPermissions = sanitizeCustomPermissions(
        profile.custom_permissions
      );
      const activeOutletId = String(profile.outlet_id);
      let resolvedOutletId = activeOutletId;
      let selectedOutletId: string | null =
        role === "owner" ? null : activeOutletId;

      if (role === "owner") {
        try {
          const cookieStore = await cookies();
          const cookieOutletId = cookieStore.get("fnb1621_active_outlet")?.value;
          if (cookieOutletId) {
            const validOutletId = await getCachedActiveOutletExists(
              cookieOutletId
            );
            if (validOutletId) {
              resolvedOutletId = validOutletId;
              selectedOutletId = validOutletId;
            }
          }
        } catch {
          // Abaikan jika pemanggilan cookies di context non-request
        }
      }

      return {
        userId: profile.id,
        email: userEmail,
        outletId: resolvedOutletId,
        selectedOutletId,
        fullName: profile.full_name,
        role,
        customPermissions,
        isActive: profile.is_active,
      };
    } catch {
      return null;
    }
  }
);

export async function getCurrentStaffSession(): Promise<AuthenticatedStaff | null> {
  return loadCurrentStaffSessionCached();
}

/**
 * Memastikan pemanggil adalah staf aktif dengan role/hak akses yang diizinkan.
 * Mengalihkan ke /login jika belum login, atau ke halaman default usernya jika tidak berhak.
 */
export async function requireStaffRole(
  allowedRoles?: ReadonlyArray<UserRole>,
  requiredPermission?: PermissionKey
): Promise<AuthenticatedStaff> {
  const staff = await getCurrentStaffSession();
  if (!staff) {
    redirect("/login");
  }

  if (allowedRoles) {
    if (requiredPermission !== undefined) {
      if (!hasUserPermission(staff.role, staff.customPermissions, requiredPermission)) {
        redirect(getDefaultRouteForUser(staff.role, staff.customPermissions));
      }
    } else if (!allowedRoles.includes(staff.role)) {
      redirect(getDefaultRouteForUser(staff.role, staff.customPermissions));
    }
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
  let profile: {
    id: string;
    outlet_id: string;
    full_name: string;
    role: string;
    is_active: boolean;
    deleted_at: string | null;
    custom_permissions?: unknown;
  } | null = null;
  let profileErr: { message: string } | null = null;

  const firstProfileRes = await admin
    .from("profiles")
    .select(
      "id, outlet_id, full_name, role, is_active, deleted_at, custom_permissions"
    )
    .eq("id", signInData.user.id)
    .maybeSingle();

  if (
    firstProfileRes.error &&
    firstProfileRes.error.message.includes("custom_permissions")
  ) {
    const fallbackRes = await admin
      .from("profiles")
      .select("id, outlet_id, full_name, role, is_active, deleted_at")
      .eq("id", signInData.user.id)
      .maybeSingle();
    profile = fallbackRes.data;
    profileErr = fallbackRes.error;
  } else {
    profile = firstProfileRes.data;
    profileErr = firstProfileRes.error;
  }

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
  const customPermissions = sanitizeCustomPermissions(
    profile.custom_permissions
  );
  const targetRoute = getDefaultRouteForUser(role, customPermissions);

  if (role === "owner") {
    try {
      const cookieStore = await cookies();
      cookieStore.delete("fnb1621_active_outlet");
    } catch {
      // Abaikan bila cookies tidak tersedia pada context pemanggilan
    }
  }

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

  try {
    const cookieStore = await cookies();
    cookieStore.delete("fnb1621_active_outlet");
  } catch {
    // Abaikan jika gagal menghapus cookie
  }

  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Ambil seluruh daftar staf lintas cabang untuk Owner di halaman /dashboard/staf.
 */
export async function listStaffMembersForOwner(): Promise<
  StaffMemberWithEmail[]
> {
  await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const [
    { data: profiles, error: profErr },
    { data: usersData },
    { data: outletsData },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("outlets").select("id, name").is("deleted_at", null),
  ]);

  if (profErr || !profiles) {
    return [];
  }

  const emailMap = new Map<string, string>();
  for (const u of usersData?.users ?? []) {
    emailMap.set(u.id, u.email ?? "-");
  }

  const outletNameMap = new Map<string, string>();
  for (const o of outletsData ?? []) {
    outletNameMap.set(String(o.id), String(o.name));
  }

  return (profiles as ProfileRow[]).map((p) => ({
    ...p,
    custom_permissions: sanitizeCustomPermissions(p.custom_permissions),
    email: emailMap.get(p.id) ?? "-",
    outletName: outletNameMap.get(String(p.outlet_id)) ?? "LATTESPACE",
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
  outletId?: string;
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
  const { fullName, email, password, role, outletId } = parsed.data;
  const targetOutletId = outletId ?? owner.outletId;

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
    outlet_id: targetOutletId,
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

  revalidateTag("staff_profiles");
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
    .eq("id", profileId);

  if (error) {
    return { ok: false, message: `Gagal mengubah role: ${error.message}` };
  }

  revalidateTag("staff_profiles");
  revalidatePath("/dashboard/staf");
  return { ok: true, message: "Role dan hak akses staf berhasil diperbarui." };
}

/**
 * Server Action (Khusus Owner): Ubah profil lengkap staf (Nama, Role, & Cabang Tugas).
 */
export async function updateStaffMemberAction(rawInput: {
  profileId: string;
  fullName: string;
  role: UserRole;
  outletId: string;
}): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"]);
  const parsed = updateStaffMemberInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data staf tidak valid.",
    };
  }

  const { profileId, fullName, role, outletId } = parsed.data;
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
    p_reason: `Pembaruan profil/cabang/hak akses staf ${fullName}`,
  });

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      outlet_id: outletId,
    })
    .eq("id", profileId);

  if (error) {
    return {
      ok: false,
      message: `Gagal memperbarui profil staf: ${error.message}`,
    };
  }

  revalidateTag("staff_profiles");
  revalidatePath("/dashboard/staf");
  return {
    ok: true,
    message: `Profil, cabang tugas, dan hak akses ${fullName} berhasil diperbarui.`,
  };
}

/**
 * Server Action (Khusus Owner): Reset kata sandi staf secara langsung.
 */
export async function resetStaffPasswordAction(rawInput: {
  profileId: string;
  newPassword: string;
}): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"]);
  const parsed = resetStaffPasswordInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Password baru tidak valid.",
    };
  }

  const { profileId, newPassword } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name, outlet_id")
    .eq("id", profileId)
    .maybeSingle();

  const { error: authErr } = await admin.auth.admin.updateUserById(profileId, {
    password: newPassword,
  });

  if (authErr) {
    return {
      ok: false,
      message: `Gagal mengubah kata sandi: ${authErr.message}`,
    };
  }

  const { ip, device } = await getRequestAuditMeta();
  await admin.from("audit_logs").insert({
    outlet_id: String(prof?.outlet_id ?? owner.outletId),
    user_id: owner.userId,
    role: owner.role,
    device,
    ip,
    action: "staff.password_reset_by_owner",
    entity: "profiles",
    entity_id: profileId,
    before: null,
    after: {
      staff_name: prof?.full_name ?? profileId,
      reset_by: owner.fullName,
    },
    reason: `Reset password staf ${prof?.full_name ?? ""} oleh Owner`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/dashboard/staf");
  return {
    ok: true,
    message: `Kata sandi untuk ${prof?.full_name ?? "staf"} berhasil diperbarui.`,
  };
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
    .eq("id", profileId);

  if (error) {
    return {
      ok: false,
      message: `Gagal memperbarui status staf: ${error.message}`,
    };
  }

  revalidateTag("staff_profiles");
  revalidatePath("/dashboard/staf");
  return {
    ok: true,
    message: isActive
      ? "Akun staf berhasil diaktifkan."
      : "Akun staf berhasil dinonaktifkan.",
  };
}

const updateStaffPermissionsInputSchema = z.object({
  profileId: z.string().uuid("ID profil staf tidak valid."),
  effectivePermissions: z.record(z.string(), z.boolean()).nullable(),
});

/**
 * Server Action (Khusus Owner): Atur hak akses per-user (override di atas izin default Role).
 * Mengirim effectivePermissions = null akan mereset hak akses user kembali ke bawaan Role-nya.
 */
export async function updateStaffPermissionsAction(rawInput: {
  profileId: string;
  effectivePermissions: Partial<Record<PermissionKey, boolean>> | null;
}): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"]);
  const parsed = updateStaffPermissionsInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data hak akses tidak valid.",
    };
  }

  const { profileId, effectivePermissions } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: targetProfile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, full_name, role, outlet_id")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !targetProfile) {
    return { ok: false, message: "Profil staf tidak ditemukan." };
  }

  const targetRole = targetProfile.role as UserRole;
  if (targetRole === "owner") {
    return {
      ok: false,
      message: "Role Owner selalu memiliki akses penuh dan tidak dapat dibatasi.",
    };
  }

  let nextCustom: UserCustomPermissions | null = null;
  if (effectivePermissions) {
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[targetRole];
    const diff: UserCustomPermissions = {};
    let hasDiff = false;
    for (const key of ALL_PERMISSION_KEYS) {
      if (typeof effectivePermissions[key] === "boolean") {
        const val = effectivePermissions[key];
        if (val !== roleDefaults[key]) {
          diff[key] = val;
          hasDiff = true;
        }
      }
    }
    nextCustom = hasDiff ? diff : null;
  }

  const { ip, device } = await getRequestAuditMeta();
  await admin.rpc("set_audit_context", {
    p_user_id: owner.userId,
    p_role: owner.role,
    p_device: device,
    p_ip: ip,
    p_reason: nextCustom
      ? `Penyesuaian hak akses per-user untuk ${targetProfile.full_name}`
      : `Reset hak akses ${targetProfile.full_name} ke bawaan Role ${targetRole}`,
  });

  const { error: updErr } = await admin
    .from("profiles")
    .update({ custom_permissions: nextCustom })
    .eq("id", profileId);

  if (updErr) {
    if (updErr.message.includes("custom_permissions")) {
      return {
        ok: false,
        message:
          "Kolom custom_permissions belum ada di database. Jalankan migrasi 0010 terlebih dahulu.",
      };
    }
    return {
      ok: false,
      message: `Gagal menyimpan hak akses user: ${updErr.message}`,
    };
  }

  revalidateTag("staff_profiles");
  revalidatePath("/dashboard/staf");
  return {
    ok: true,
    message: nextCustom
      ? `Hak akses khusus untuk ${targetProfile.full_name} berhasil disimpan.`
      : `Hak akses ${targetProfile.full_name} dikembalikan ke standar Role.`,
  };
}

const changeOwnPasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi."),
  newPassword: z
    .string()
    .min(8, "Kata sandi baru minimal 8 karakter.")
    .max(100),
});

/**
 * Server Action (Semua staf aktif): Mengganti kata sandi akun sendiri dari dalam aplikasi.
 */
export async function changeOwnPasswordAction(rawInput: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  const staff = await getCurrentStaffSession();
  if (!staff) {
    return {
      ok: false,
      message: "Sesi login Anda telah berakhir. Silakan login kembali.",
    };
  }

  const parsed = changeOwnPasswordInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Data kata sandi tidak valid.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: staff.email,
    password: parsed.data.currentPassword,
  });

  if (verifyErr) {
    return {
      ok: false,
      message: "Kata sandi saat ini tidak sesuai.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { error: updErr } = await admin.auth.admin.updateUserById(
    staff.userId,
    {
      password: parsed.data.newPassword,
    }
  );

  if (updErr) {
    return {
      ok: false,
      message: `Gagal memperbarui kata sandi: ${updErr.message}`,
    };
  }

  const { ip, device } = await getRequestAuditMeta();
  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "staff.password_changed_self",
    entity: "profiles",
    entity_id: staff.userId,
    before: null,
    after: {
      staff_name: staff.fullName,
      email: staff.email,
    },
    reason: `Staf ${staff.fullName} mengubah kata sandinya sendiri`,
    prev_hash: "",
    hash: "",
  });

  return {
    ok: true,
    message: "Kata sandi Anda berhasil diperbarui.",
  };
}

/**
 * Server Action: Mencatat audit log setelah staf berhasil mereset kata sandinya sendiri via email recovery.
 */
export async function recordSelfPasswordResetAuditAction(): Promise<ActionResult> {
  const staff = await getCurrentStaffSession();
  if (!staff) {
    return { ok: true, message: "Kata sandi diperbarui." };
  }

  const admin = createSupabaseAdminClient();
  const { ip, device } = await getRequestAuditMeta();
  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "staff.password_reset_self",
    entity: "profiles",
    entity_id: staff.userId,
    before: null,
    after: {
      staff_name: staff.fullName,
      email: staff.email,
    },
    reason: `Staf ${staff.fullName} mereset kata sandinya sendiri melalui link email`,
    prev_hash: "",
    hash: "",
  });

  return {
    ok: true,
    message: "Kata sandi baru berhasil disimpan.",
    redirectTo: getDefaultRouteForUser(staff.role, staff.customPermissions),
  };
}

