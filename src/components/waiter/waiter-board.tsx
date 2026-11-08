"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Utensils, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTimeWIB } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  markOrderServedAction,
  type WaiterWorkspaceData,
} from "@/server/kitchen-waiter";

function playWaiterChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch {
    // Abaikan bila browser belum mengizinkan audio otomatis
  }
}

export function WaiterBoard({
  initialData,
}: {
  initialData: WaiterWorkspaceData;
}) {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const prevReadyIdsRef = useRef<Set<string>>(
    new Set(initialData.readyTickets.map((t) => t.id))
  );

  // Bunyi notifikasi ketika ada pesanan READY baru dari dapur
  useEffect(() => {
    const currentReady = new Set(initialData.readyTickets.map((t) => t.id));
    let hasNewReady = false;
    for (const id of currentReady) {
      if (!prevReadyIdsRef.current.has(id)) {
        hasNewReady = true;
      }
    }
    if (soundEnabled && hasNewReady) {
      playWaiterChime();
    }
    prevReadyIdsRef.current = currentReady;
  }, [initialData.readyTickets, soundEnabled]);

  // Langganan Supabase Realtime untuk tabel orders
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`waiter-orders-${initialData.staff.outletId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `outlet_id=eq.${initialData.staff.outletId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialData.staff.outletId, router]);

  async function handleMarkServed(orderId: string, expectedVersion: number) {
    setProcessingOrderId(orderId);
    setFeedback(null);
    try {
      const res = await markOrderServedAction({ orderId, expectedVersion });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      router.refresh();
    } finally {
      setProcessingOrderId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Bar Layar Antar Pelayan */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-zinc-900">
            <Utensils className="h-5 w-5 text-slate-700" />
            Layar Antar Meja ({initialData.readyTickets.length} Pesanan Siap
            Diantar)
          </h1>
          <p className="text-xs text-zinc-600">
            Ambil pesanan di pass Kitchen dan antar ke meja tujuan. Saat Anda
            menekan <strong>Sudah Diantar</strong>, sesi pantau pelanggan pada
            meja tersebut otomatis selesai.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playWaiterChime();
            }}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="mr-1.5 h-4 w-4" />
                Nada Panggil Aktif
              </>
            ) : (
              <>
                <VolumeX className="mr-1.5 h-4 w-4" />
                Nada Panggil Mati
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
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-red-300 bg-red-50 text-red-950"
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

      {/* Daftar Kartu Pesanan Siap Antar */}
      {initialData.readyTickets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            Belum ada pesanan yang siap diantar saat ini. Pesanan akan muncul
            otomatis begitu Kitchen menekan tombol <strong>Siap Saji</strong>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialData.readyTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="flex flex-col justify-between border-2 border-emerald-600 bg-white shadow-sm"
            >
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="success" className="mb-1">
                      SIAP DIANTAR KE MEJA
                    </Badge>
                    <CardTitle className="text-2xl font-extrabold text-zinc-900">
                      {ticket.tableName}
                    </CardTitle>
                    <CardDescription className="mt-0.5 font-mono text-xs font-semibold text-zinc-700">
                      Order #{ticket.orderNo} • Siap pukul{" "}
                      {formatTimeWIB(ticket.readyAt)}
                    </CardDescription>
                  </div>

                  {ticket.tableNo !== null && (
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-zinc-900 text-white">
                      <span className="text-[10px] uppercase leading-none opacity-80">
                        Meja
                      </span>
                      <span className="text-lg font-extrabold leading-tight">
                        {ticket.tableNo}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-4">
                <div className="divide-y divide-zinc-200">
                  {ticket.items.map((item) => (
                    <div key={item.id} className="py-2.5 first:pt-0">
                      <div className="flex items-baseline gap-2.5">
                        <span className="inline-flex min-w-9 items-center justify-center rounded-lg bg-emerald-700 px-2 py-1 text-base font-extrabold text-white">
                          {item.qty}x
                        </span>
                        <span className="text-base font-bold text-zinc-900">
                          {item.productName}
                        </span>
                      </div>
                      {item.note && (
                        <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-100/80 px-2.5 py-1 text-xs font-bold text-amber-950">
                          Catatan: {item.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  disabled={processingOrderId === ticket.id}
                  onClick={() => handleMarkServed(ticket.id, ticket.version)}
                  className="min-h-12 w-full bg-zinc-900 text-base font-bold text-white hover:bg-zinc-800"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {processingOrderId === ticket.id
                    ? "Memproses..."
                    : `Sudah Diantar (${ticket.tableName})`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
