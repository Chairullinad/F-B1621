import "server-only";
import {
  getOutletOrdersLiveTopic,
  ORDER_REALTIME_EVENT,
  type OrderRealtimeBroadcastEventType,
  type OrderRealtimeBroadcastPayload,
} from "@/lib/realtime-channels";

/**
 * Mengirim sinyal broadcast real-time ke channel outlet via Supabase Realtime REST API
 * tanpa membuka koneksi WebSocket di server action. Non-blocking / fail-safe.
 */
export async function broadcastOutletOrderChange(params: {
  outletId: string;
  orderId: string;
  eventType: OrderRealtimeBroadcastEventType;
  source?: string | null;
  status?: string | null;
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey || !params.outletId) {
    return;
  }

  const payload: OrderRealtimeBroadcastPayload = {
    orderId: params.orderId,
    eventType: params.eventType,
    source: params.source ?? null,
    status: params.status ?? null,
    sentAt: Date.now(),
  };

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: getOutletOrdersLiveTopic(params.outletId),
            event: ORDER_REALTIME_EVENT,
            payload,
            private: false,
          },
        ],
      }),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
  } catch {
    // Abaikan kegagalan broadcast sekunder agar transaksi utama tetap sukses
  }
}
