"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  ChefHat,
  Printer,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isOperationalOrderRealtimeEvent,
  useDebouncedOrdersRealtime,
} from "@/hooks/use-debounced-orders-realtime";
import { playToneSequence } from "@/lib/audio";
import { formatTimeWIB } from "@/lib/datetime";
import {
  markOrderReadyAction,
  startOrderCookingAction,
  type KitchenWorkspaceData,
} from "@/server/kitchen-waiter";

function playKitchenBell(isCancelledAlert: boolean) {
  playToneSequence(
    [
      {
        freq: isCancelledAlert ? 330 : 783.99,
        delaySec: 0,
        durationSec: 0.22,
      },
      {
        freq: isCancelledAlert ? 220 : 1046.5,
        delaySec: 0.16,
        durationSec: 0.42,
      },
    ],
    {
      type: isCancelledAlert ? "sawtooth" : "triangle",
      gain: 0.22,
    }
  );
}

function getElapsedMinutes(isoTimestamp: string, nowMs: number): number {
  const diffMs = Math.max(0, nowMs - new Date(isoTimestamp).getTime());
  return Math.floor(diffMs / 60000);
}

export function KitchenBoard({
  initialData,
}: {
  initialData: KitchenWorkspaceData;
}) {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(
    null
  );
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<
    Set<string>
  >(new Set());
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const prevPaidIdsRef = useRef<Set<string>>(
    new Set(initialData.paidTickets.map((t) => t.id))
  );
  const prevCancelledIdsRef = useRef<Set<string>>(
    new Set(initialData.recentCancelledPaidTickets.map((t) => t.id))
  );

  // Deteksi tiket PAID baru atau pembatalan baru untuk membunyikan bel dapur
  useEffect(() => {
    const currentPaid = new Set(initialData.paidTickets.map((t) => t.id));
    const currentCancelled = new Set(
      initialData.recentCancelledPaidTickets.map((t) => t.id)
    );

    let hasNewPaid = false;
    let hasNewCancelled = false;

    for (const id of currentPaid) {
      if (!prevPaidIdsRef.current.has(id)) {
        hasNewPaid = true;
      }
    }
    for (const id of currentCancelled) {
      if (!prevCancelledIdsRef.current.has(id)) {
        hasNewCancelled = true;
      }
    }

    if (soundEnabled && (hasNewCancelled || hasNewPaid)) {
      playKitchenBell(hasNewCancelled);
    }

    prevPaidIdsRef.current = currentPaid;
    prevCancelledIdsRef.current = currentCancelled;
  }, [
    initialData.paidTickets,
    initialData.recentCancelledPaidTickets,
    soundEnabled,
  ]);

  // Langganan Supabase Realtime untuk perubahan tabel orders (ter-debounce & abaikan order pending/expired)
  useDebouncedOrdersRealtime({
    channelName: `kitchen-orders-${initialData.staff.outletId}`,
    outletId: initialData.staff.outletId,
    debounceMs: 450,
    shouldRefreshOnOrderEvent: isOperationalOrderRealtimeEvent,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        setNowMs(Date.now());
      }
    }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const visibleCancelledTickets = useMemo(
    () =>
      initialData.recentCancelledPaidTickets.filter(
        (t) => !dismissedCancelledIds.has(t.id)
      ),
    [initialData.recentCancelledPaidTickets, dismissedCancelledIds]
  );

  async function handleStartCooking(orderId: string) {
    setProcessingOrderId(orderId);
    setFeedback(null);
    try {
      const res = await startOrderCookingAction({ orderId });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      router.refresh();
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function handleMarkReady(orderId: string, expectedVersion: number) {
    setProcessingOrderId(orderId);
    setFeedback(null);
    try {
      const res = await markOrderReadyAction({ orderId, expectedVersion });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      router.refresh();
    } finally {
      setProcessingOrderId(null);
    }
  }

  const newQueueCount = initialData.paidTickets.filter(
    (t) => !t.cookingStartedAt
  ).length;
  const cookingCount = initialData.paidTickets.filter((t) =>
    Boolean(t.cookingStartedAt)
  ).length;

  return (
    <div className="space-y-4">
      {/* 3 KPI Stat Cards KDS (Antrian Baru, Sedang Dimasak, Siap Disajikan) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Antrian Baru
          </div>
          <div className="mt-1 text-3xl font-extrabold text-amber-500">
            {newQueueCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Menunggu mulai dimasak
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Sedang Dimasak
          </div>
          <div className="mt-1 text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            {cookingCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Diproses koki di Kitchen
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Siap Disajikan (READY)
          </div>
          <div className="mt-1 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {initialData.readyCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Menunggu diantar pelayan
          </div>
        </div>
      </div>

      {/* Header Bar Layar Kitchen */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
            <ChefHat className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            Layar Kitchen (KDS) — 1621 Group
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Alur 3 tahap: Klik <strong>Mulai Masak</strong> saat pesanan
            diproses, lalu tekan <strong>Siap Saji</strong> agar pelayan
            mengantar ke meja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playKitchenBell(false);
            }}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="mr-1.5 h-4 w-4" />
                Bel Kitchen Aktif
              </>
            ) : (
              <>
                <VolumeX className="mr-1.5 h-4 w-4" />
                Bel Kitchen Mati
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.refresh()}
          >
            Muat Ulang
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          }`}
        >
          <span>{feedback.text}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFeedback(null)}
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Peringatan Order yang Baru Dibatalkan Kasir (PRD 5.8) */}
      {visibleCancelledTickets.length > 0 && (
        <div className="space-y-2.5">
          {visibleCancelledTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-600 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-4 text-red-950 dark:text-red-200 shadow-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">
                    <AlertOctagon className="mr-1 h-3.5 w-3.5" />
                    DIBATALKAN — BERHENTI MEMASAK
                  </Badge>
                  <span className="text-base font-extrabold">
                    {ticket.tableName} • #{ticket.orderNo}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-red-900 dark:text-red-300">
                  Item:{" "}
                  {ticket.items
                    .map((i) => `${i.qty}x ${i.productName}`)
                    .join(", ")}
                  {ticket.cancelReason
                    ? ` • Alasan: "${ticket.cancelReason}"`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDismissedCancelledIds((prev) => {
                    const next = new Set(prev);
                    next.add(ticket.id);
                    return next;
                  })
                }
              >
                Mengerti / Sembunyikan
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Grid Kartu Tiket Dapur */}
      {initialData.paidTickets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500 dark:text-slate-400">
            Tidak ada antrean pesanan yang perlu dimasak saat ini. Pesanan baru
            akan muncul otomatis begitu kasir mengonfirmasi pembayaran.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialData.paidTickets.map((ticket, index) => {
            const elapsedMins = getElapsedMinutes(ticket.paidAt, nowMs);
            const isUrgent = elapsedMins >= 10;
            const isWarning = elapsedMins >= 5 && elapsedMins < 10;

            return (
              <Card
                key={ticket.id}
                className={`flex flex-col justify-between border-2 ${
                  isUrgent
                    ? "border-red-500 bg-red-50/30 dark:border-red-500/70 dark:bg-red-950/20"
                    : isWarning
                      ? "border-amber-400 bg-amber-50/20 dark:border-amber-500/70 dark:bg-amber-950/20"
                      : "border-zinc-900 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                <CardHeader className="border-b border-zinc-200 dark:border-slate-800 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 dark:bg-slate-700 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <CardTitle className="text-xl font-extrabold">
                          {ticket.tableName}
                        </CardTitle>
                      </div>
                      <CardDescription className="mt-1 font-mono text-xs font-semibold text-zinc-700 dark:text-slate-300">
                        Order #{ticket.orderNo} • Bayar{" "}
                        {formatTimeWIB(ticket.paidAt)}
                      </CardDescription>
                    </div>

                    <Badge
                      variant={
                        isUrgent
                          ? "destructive"
                          : isWarning
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {elapsedMins === 0
                        ? "Baru Masuk"
                        : `${elapsedMins} mnt lalu`}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-4">
                  <div className="divide-y divide-zinc-200 dark:divide-slate-800">
                    {ticket.items.map((item) => (
                      <div key={item.id} className="py-2.5 first:pt-0">
                        <div className="flex items-baseline gap-2.5">
                          <span className="inline-flex min-w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-slate-800 px-2 py-1 text-base font-extrabold text-white">
                            {item.qty}x
                          </span>
                          <span className="text-base font-bold text-zinc-900 dark:text-slate-100">
                            {item.productName}
                          </span>
                        </div>
                        {item.note && (
                          <div className="mt-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-100/80 dark:bg-amber-950/50 px-2.5 py-1 text-xs font-bold text-amber-950 dark:text-amber-200">
                            Catatan Kitchen: {item.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dapur/struk/${ticket.id}`}>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 px-3 text-sm font-semibold"
                        title="Cetak tiket antrean kitchen (Bluetooth / Browser)"
                      >
                        <Printer className="mr-1.5 h-4 w-4" />
                        Cetak Struk
                      </Button>
                    </Link>
                    {!ticket.cookingStartedAt ? (
                      <Button
                        type="button"
                        disabled={processingOrderId === ticket.id}
                        onClick={() => handleStartCooking(ticket.id)}
                        className="min-h-11 flex-1 bg-blue-100 text-sm font-bold text-blue-900 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
                      >
                        <ChefHat className="mr-1.5 h-4 w-4" />
                        Mulai Masak
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      disabled={processingOrderId === ticket.id}
                      onClick={() =>
                        handleMarkReady(ticket.id, ticket.version)
                      }
                      className="min-h-11 flex-1 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      {processingOrderId === ticket.id
                        ? "Memproses..."
                        : `Siap Saji (${ticket.tableName})`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

