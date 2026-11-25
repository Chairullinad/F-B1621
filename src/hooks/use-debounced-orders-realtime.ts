"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface UseDebouncedOrdersRealtimeOptions {
  channelName: string;
  outletId: string;
  debounceMs?: number;
  shouldRefreshOnOrderEvent?: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => boolean;
}

/**
 * Memfilter event Realtime `orders` agar layar Dapur/Antar tidak me-refresh
 * saat order baru masuk masih `pending` atau baru kedaluwarsa (`expired`).
 */
export function isOperationalOrderRealtimeEvent(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
): boolean {
  const newRow = payload.new as Record<string, unknown> | undefined;
  const nextStatus = newRow?.status;
  return nextStatus !== "pending" && nextStatus !== "expired";
}

/**
 * Berlangganan perubahan tabel `orders` per outlet lewat Supabase Realtime
 * dan men-debounce `router.refresh()` agar perubahan batch tidak memicu SSR berulang.
 */
export function useDebouncedOrdersRealtime({
  channelName,
  outletId,
  debounceMs = 450,
  shouldRefreshOnOrderEvent,
}: UseDebouncedOrdersRealtimeOptions): void {
  const router = useRouter();
  const predicateRef = useRef(shouldRefreshOnOrderEvent);

  useEffect(() => {
    predicateRef.current = shouldRefreshOnOrderEvent;
  }, [shouldRefreshOnOrderEvent]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        router.refresh();
      }, debounceMs);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `outlet_id=eq.${outletId}`,
        },
        (payload) => {
          const typedPayload = payload as RealtimePostgresChangesPayload<
            Record<string, unknown>
          >;
          if (predicateRef.current && !predicateRef.current(typedPayload)) {
            return;
          }
          scheduleRefresh();
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [channelName, outletId, debounceMs, router]);
}
