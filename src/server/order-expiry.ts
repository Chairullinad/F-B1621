import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ExpireOrdersJobResult {
  expiredCount: number;
  expiredOrderIds: string[];
  expiredOrderNos: string[];
  executedAt: string;
}

/**
 * Job Server: Mengubah semua order berstatus PENDING yang telah melewati
 * batas waktu 15 menit (expires_at <= now()) menjadi EXPIRED.
 * Berjalan di sisi server tanpa memerlukan browser pelanggan tetap terbuka.
 */
export async function runExpireOverdueOrdersJob(): Promise<ExpireOrdersJobResult> {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Coba panggil RPC expire_overdue_pending_orders bila migrasi 0005 sudah aktif
  const { data: rpcData, error: rpcError } = await admin.rpc(
    "expire_overdue_pending_orders"
  );

  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    const first = rpcData[0] as {
      expired_count?: number;
      expired_order_ids?: string[];
      expired_order_nos?: string[];
    };
    return {
      expiredCount: Number(first.expired_count ?? 0),
      expiredOrderIds: Array.isArray(first.expired_order_ids)
        ? first.expired_order_ids.map(String)
        : [],
      expiredOrderNos: Array.isArray(first.expired_order_nos)
        ? first.expired_order_nos.map(String)
        : [],
      executedAt: nowIso,
    };
  }

  // 2. Fallback eksekusi langsung dari server dengan konteks audit sistem
  await admin.rpc("set_audit_context", {
    p_user_id: null,
    p_role: "system",
    p_device: "server-expiry-job",
    p_ip: "127.0.0.1",
    p_reason:
      "Kedaluwarsa otomatis 15 menit tanpa pembayaran/verifikasi kasir",
  });

  const { data: updatedRows, error: updateErr } = await admin
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso)
    .select("id, order_no");

  if (updateErr) {
    throw new Error(
      `Gagal menjalankan job kedaluwarsa order: ${updateErr.message}`
    );
  }

  const rows = (updatedRows ?? []) as Array<{ id: string; order_no: string }>;
  return {
    expiredCount: rows.length,
    expiredOrderIds: rows.map((r) => String(r.id)),
    expiredOrderNos: rows.map((r) => String(r.order_no)),
    executedAt: nowIso,
  };
}
