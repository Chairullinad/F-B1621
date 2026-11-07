"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "@/server/auth";

export interface AuditChainVerificationStatus {
  isValid: boolean;
  checkedRows: number;
  brokenAtId: number | null;
  errorMessage: string;
}

export interface AuditLogRowView {
  id: number;
  createdAt: string;
  userId: string | null;
  actorName: string;
  role: string;
  device: string | null;
  ip: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  orderId: string | null;
  orderNo: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  prevHash: string;
  hash: string;
}

export interface OrderAuditTimelineGroup {
  orderId: string;
  orderNo: string;
  tableName: string;
  status: string;
  total: number;
  createdAt: string;
  events: AuditLogRowView[];
}

export interface AuditTrailDashboardData {
  staff: {
    userId: string;
    fullName: string;
    role: UserRole;
    outletId: string;
  };
  chainVerification: AuditChainVerificationStatus;
  staffOptions: Array<{ id: string; fullName: string; role: UserRole }>;
  logs: AuditLogRowView[];
  orderTimelines: OrderAuditTimelineGroup[];
}

function getWibPeriodStartIso(period: "today" | "7d" | "30d" | "all"): string | null {
  if (period === "all") return null;
  const nowUtcMs = Date.now();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWib = new Date(nowUtcMs + wibOffsetMs);

  const startOfTodayWibUtcMs =
    Date.UTC(
      nowWib.getUTCFullYear(),
      nowWib.getUTCMonth(),
      nowWib.getUTCDate(),
      0,
      0,
      0,
      0
    ) - wibOffsetMs;

  const daysLookback = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return new Date(
    startOfTodayWibUtcMs - daysLookback * 24 * 60 * 60 * 1000
  ).toISOString();
}

/**
 * Mengambil seluruh data untuk halaman Jejak Audit Owner (/dashboard/audit):
 * - Status verifikasi rantai hash SHA-256 (verify_audit_chain)
 * - Daftar catatan audit_logs (append-only)
 * - Pengelompokan Riwayat Lengkap per Order (siapa membuat, merevisi, diskon, bayar, siap, antar, batal/refund)
 */
export async function getAuditTrailDashboardData(rawFilters?: {
  period?: "today" | "7d" | "30d" | "all";
}): Promise<AuditTrailDashboardData> {
  const staff = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const period = rawFilters?.period ?? "7d";
  const startIso = getWibPeriodStartIso(period);

  let logsQuery = admin
    .from("audit_logs")
    .select("*")
    .or(`outlet_id.eq.${staff.outletId},outlet_id.is.null`)
    .order("id", { ascending: false })
    .limit(400);

  if (startIso) {
    logsQuery = logsQuery.gte("created_at", startIso);
  }

  const [chainRes, logsRes, profilesRes, ordersRes, tablesRes] =
    await Promise.all([
      admin.rpc("verify_audit_chain"),
      logsQuery,
      admin
        .from("profiles")
        .select("id, full_name, role")
        .eq("outlet_id", staff.outletId),
      admin
        .from("orders")
        .select("id, order_no, table_id, order_type, status, total, created_at")
        .eq("outlet_id", staff.outletId)
        .order("created_at", { ascending: false })
        .limit(300),
      admin
        .from("tables")
        .select("id, name")
        .eq("outlet_id", staff.outletId),
    ]);

  const rawChain = Array.isArray(chainRes.data) ? chainRes.data[0] : null;
  const chainVerification: AuditChainVerificationStatus = {
    isValid: Boolean(rawChain?.is_valid ?? true),
    checkedRows: Number(rawChain?.checked_rows ?? 0),
    brokenAtId:
      rawChain?.broken_at_id !== null && rawChain?.broken_at_id !== undefined
        ? Number(rawChain.broken_at_id)
        : null,
    errorMessage: String(
      rawChain?.error_message ?? "Rantai hash audit_logs utuh dan valid."
    ),
  };

  const profileMap = new Map<string, { fullName: string; role: UserRole }>();
  const staffOptions: Array<{ id: string; fullName: string; role: UserRole }> =
    [];
  for (const p of profilesRes.data ?? []) {
    const entry = {
      id: String(p.id),
      fullName: String(p.full_name),
      role: p.role as UserRole,
    };
    profileMap.set(entry.id, { fullName: entry.fullName, role: entry.role });
    staffOptions.push(entry);
  }

  const tableMap = new Map<string, string>();
  for (const t of tablesRes.data ?? []) {
    tableMap.set(String(t.id), String(t.name));
  }

  const orderMap = new Map<
    string,
    {
      id: string;
      orderNo: string;
      tableName: string;
      status: string;
      total: number;
      createdAt: string;
    }
  >();
  for (const o of ordersRes.data ?? []) {
    const id = String(o.id);
    const tblId = (o.table_id as string | null) ?? null;
    orderMap.set(id, {
      id,
      orderNo: String(o.order_no),
      tableName:
        (tblId ? tableMap.get(tblId) : undefined) ??
        (o.order_type === "takeaway" ? "Takeaway / Bungkus" : "-"),
      status: String(o.status),
      total: Number(o.total ?? 0),
      createdAt: String(o.created_at),
    });
  }

  const rawLogs = (logsRes.data ?? []) as Array<Record<string, unknown>>;

  const mappedLogs: AuditLogRowView[] = rawLogs.map((row) => {
    const userId = (row.user_id as string | null) ?? null;
    const role = String(row.role ?? "system");
    const entity = String(row.entity ?? "");
    const entityId = (row.entity_id as string | null) ?? null;
    const beforeObj =
      row.before && typeof row.before === "object"
        ? (row.before as Record<string, unknown>)
        : null;
    const afterObj =
      row.after && typeof row.after === "object"
        ? (row.after as Record<string, unknown>)
        : null;

    // Resolusi orderId & orderNo baik dari entity='orders' maupun dari field order_id di dalam before/after
    let resolvedOrderId: string | null = null;
    if (entity === "orders" && entityId) {
      resolvedOrderId = entityId;
    } else if (typeof afterObj?.order_id === "string") {
      resolvedOrderId = afterObj.order_id;
    } else if (typeof beforeObj?.order_id === "string") {
      resolvedOrderId = beforeObj.order_id;
    }

    const orderMeta = resolvedOrderId ? orderMap.get(resolvedOrderId) : undefined;
    const resolvedOrderNo =
      orderMeta?.orderNo ??
      (typeof afterObj?.order_no === "string"
        ? afterObj.order_no
        : typeof beforeObj?.order_no === "string"
          ? beforeObj.order_no
          : null);

    let actorName = "Sistem Otomatis";
    if (userId && profileMap.has(userId)) {
      actorName = profileMap.get(userId)?.fullName ?? "Staf";
    } else if (role === "customer" || role === "anon") {
      actorName = "Pelanggan (Scan QR Meja)";
    } else if (role === "owner" || role === "cashier" || role === "kitchen" || role === "waiter") {
      actorName = `Staf (${role.toUpperCase()})`;
    }

    return {
      id: Number(row.id),
      createdAt: String(row.created_at),
      userId,
      actorName,
      role,
      device: (row.device as string | null) ?? null,
      ip: (row.ip as string | null) ?? null,
      action: String(row.action),
      entity,
      entityId,
      orderId: resolvedOrderId,
      orderNo: resolvedOrderNo,
      before: beforeObj,
      after: afterObj,
      reason: (row.reason as string | null) ?? null,
      prevHash: String(row.prev_hash ?? ""),
      hash: String(row.hash ?? ""),
    };
  });

  // Kelompokkan Riwayat Lengkap per Order secara kronologis (dari pembuatan hingga selesai/batal)
  const eventsByOrderId = new Map<string, AuditLogRowView[]>();
  for (const log of mappedLogs) {
    if (!log.orderId) continue;
    const list = eventsByOrderId.get(log.orderId) ?? [];
    list.push(log);
    eventsByOrderId.set(log.orderId, list);
  }

  const orderTimelines: OrderAuditTimelineGroup[] = [];
  for (const [ordId, events] of eventsByOrderId.entries()) {
    const meta = orderMap.get(ordId);
    const sortedAsc = [...events].sort((a, b) => a.id - b.id);
    const fallbackOrderNo =
      sortedAsc.find((e) => e.orderNo)?.orderNo ?? ordId.slice(0, 8);

    orderTimelines.push({
      orderId: ordId,
      orderNo: meta?.orderNo ?? fallbackOrderNo,
      tableName: meta?.tableName ?? "-",
      status: meta?.status ?? "unknown",
      total: meta?.total ?? 0,
      createdAt: meta?.createdAt ?? sortedAsc[0]?.createdAt ?? "",
      events: sortedAsc,
    });
  }

  return {
    staff: {
      userId: staff.userId,
      fullName: staff.fullName,
      role: staff.role,
      outletId: staff.outletId,
    },
    chainVerification,
    staffOptions,
    logs: mappedLogs,
    orderTimelines,
  };
}

/**
 * Server Action: Menjalankan pemeriksaan keutuhan rantai hash audit_logs (verify_audit_chain)
 * secara langsung atas permintaan Owner.
 */
export async function verifyAuditChainNowAction(): Promise<
  ActionResult & { verification?: AuditChainVerificationStatus }
> {
  await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.rpc("verify_audit_chain");
  if (error) {
    return {
      ok: false,
      message: `Gagal memeriksa rantai hash: ${error.message}`,
    };
  }

  const row = Array.isArray(data) ? data[0] : null;
  const verification: AuditChainVerificationStatus = {
    isValid: Boolean(row?.is_valid ?? true),
    checkedRows: Number(row?.checked_rows ?? 0),
    brokenAtId:
      row?.broken_at_id !== null && row?.broken_at_id !== undefined
        ? Number(row.broken_at_id)
        : null,
    errorMessage: String(
      row?.error_message ?? "Rantai hash audit_logs utuh dan valid."
    ),
  };

  revalidatePath("/dashboard/audit");
  return {
    ok: verification.isValid,
    verification,
    message: verification.isValid
      ? `Verifikasi selesai: seluruh ${verification.checkedRows} catatan audit_logs memiliki rantai hash SHA-256 yang utuh.`
      : `PERINGATAN: Rantai hash rusak pada ID #${verification.brokenAtId} (${verification.errorMessage})!`,
  };
}
