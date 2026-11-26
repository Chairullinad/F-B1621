"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  getOutletOrdersLiveTopic,
  isOperationalBroadcastEvent,
  ORDER_REALTIME_EVENT,
  type OrderRealtimeBroadcastPayload,
} from "@/lib/realtime-channels";
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
 * (Postgres Changes + Broadcast instan) dengan auto-reconnect dan fallback polling adaptif.
 */
export function useDebouncedOrdersRealtime({
  channelName,
  outletId,
  debounceMs = 250,
  shouldRefreshOnOrderEvent,
}: UseDebouncedOrdersRealtimeOptions): void {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const predicateRef = useRef(shouldRefreshOnOrderEvent);

  useEffect(() => {
    predicateRef.current = shouldRefreshOnOrderEvent;
  }, [shouldRefreshOnOrderEvent]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let reconnectAttempt = 0;
    let isSubscribed = false;
    let activeDbChannel: ReturnType<typeof supabase.channel> | null = null;
    let activeBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;

    const triggerRefreshNow = () => {
      if (disposed) return;
      if (typeof document !== "undefined" && document.hidden) return;
      startTransition(() => {
        router.refresh();
      });
    };

    const scheduleRefresh = () => {
      if (disposed) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        triggerRefreshNow();
      }, debounceMs);
    };

    const cleanupChannels = () => {
      if (activeDbChannel) {
        void supabase.removeChannel(activeDbChannel);
        activeDbChannel = null;
      }
      if (activeBroadcastChannel) {
        void supabase.removeChannel(activeBroadcastChannel);
        activeBroadcastChannel = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      const delayMs = Math.min(5000, 1200 * Math.pow(1.5, reconnectAttempt));
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectChannels();
      }, delayMs);
    };

    const connectChannels = () => {
      if (disposed) return;
      cleanupChannels();

      const suffix = reconnectAttempt > 0 ? `-r${reconnectAttempt}` : "";

      const dbChannel = supabase
        .channel(`${channelName}${suffix}`)
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
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            isSubscribed = true;
            reconnectAttempt = 0;
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            isSubscribed = false;
            scheduleReconnect();
          }
        });

      const broadcastChannel = supabase
        .channel(`${getOutletOrdersLiveTopic(outletId)}${suffix}`, {
          config: { broadcast: { self: false } },
        })
        .on("broadcast", { event: ORDER_REALTIME_EVENT }, ({ payload }) => {
          const typed = payload as Partial<OrderRealtimeBroadcastPayload> | undefined;
          if (predicateRef.current && !isOperationalBroadcastEvent(typed)) {
            return;
          }
          scheduleRefresh();
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            isSubscribed = true;
            reconnectAttempt = 0;
          }
        });

      activeDbChannel = dbChannel;
      activeBroadcastChannel = broadcastChannel;
    };

    connectChannels();

    // Polling adaptif: 4 detik saat WebSocket belum SUBSCRIBED, 25 detik saat WebSocket sehat
    let tickCount = 0;
    fallbackPollTimer = setInterval(() => {
      if (disposed || (typeof document !== "undefined" && document.hidden)) return;
      tickCount += 1;
      if (!isSubscribed) {
        triggerRefreshNow();
      } else if (tickCount % 6 === 0) {
        triggerRefreshNow();
      }
    }, 4000);

    const handleVisibilityOrOnline = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!isSubscribed) {
        connectChannels();
      }
      scheduleRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    window.addEventListener("online", handleVisibilityOrOnline);

    return () => {
      disposed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackPollTimer) clearInterval(fallbackPollTimer);
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      window.removeEventListener("online", handleVisibilityOrOnline);
      cleanupChannels();
    };
  }, [channelName, outletId, debounceMs, router]);
}
