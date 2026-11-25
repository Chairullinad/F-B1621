"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Bell,
  CheckCircle2,
  Eye,
  Printer,
  QrCode,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
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
import { Input } from "@/components/ui/input";
import { formatDateTimeWIB, formatTimeWIB } from "@/lib/datetime";
import { formatRupiah } from "@/lib/money";
import { generateQrSvgString } from "@/lib/qrcode";
import { DEFAULT_FALLBACK_STATIC_QRIS } from "@/lib/qris";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { OrderStatus, RefundReasonCategory } from "@/lib/types/database";
import {
  applyOrderDiscountAction,
  cancelOrderWithRefundAction,
  processOrderPaymentAction,
  rebillOrderAction,
  revisePendingOrderItemsAction,
  type CashierOrderCardView,
  type CashierWorkspaceData,
} from "@/server/cashier";

interface PresencePayload {
  userId: string;
  fullName: string;
  selectedOrderId: string | null;
  updatedAt: string;
}

interface DraftRevisionItem {
  productId: string;
  productName: string;
  unitPrice: number;
  qty: number;
  note: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "MENUNGGU BAYAR",
  paid: "DIBAYAR (MASUK KITCHEN)",
  ready: "SIAP ANTAR",
  served: "SELESAI DISAJIKAN",
  cancelled: "DIBATALKAN",
  expired: "KEDALUWARSA",
};

const STATUS_VARIANTS: Record<
  OrderStatus,
  "default" | "secondary" | "warning" | "success" | "destructive" | "outline"
> = {
  pending: "warning",
  paid: "default",
  ready: "success",
  served: "secondary",
  cancelled: "destructive",
  expired: "outline",
};

function playNotificationBeep(isQrisClaim: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, startDelay: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isQrisClaim ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + startDelay);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startDelay + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + duration);
    };

    if (isQrisClaim) {
      // 3 nada ceria untuk konfirmasi pembayaran QRIS: C5 -> E5 -> G5
      playTone(523.25, 0, 0.22);
      playTone(659.25, 0.16, 0.22);
      playTone(783.99, 0.32, 0.38);
    } else {
      // 2 nada ding-dong untuk pesanan baru: D5 -> A5
      playTone(587.33, 0, 0.22);
      playTone(880.0, 0.18, 0.35);
    }
  } catch {
    // Abaikan jika browser memblokir autoplay audio sebelum interaksi
  }
}

// Alarm terus-menerus (looping chimes) sampai kasir mematikan atau menerima order
class ContinuousOrderAlarm {
  private intervalId: number | null = null;
  private isQris = false;

  start(isQris: boolean) {
    this.isQris = isQris;
    if (this.intervalId !== null) return;
    playNotificationBeep(this.isQris);
    this.intervalId = window.setInterval(() => {
      playNotificationBeep(this.isQris);
    }, 1800);
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isPlaying() {
    return this.intervalId !== null;
  }
}

const orderAlarmService = new ContinuousOrderAlarm();

export function CashierWorkspace({
  initialData,
}: {
  initialData: CashierWorkspaceData;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialData.pendingOrders[0]?.id ??
      initialData.recentOrders[0]?.id ??
      null
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
    paidOrderId?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Realtime Presence: melacak order mana yang sedang dibuka oleh kasir lain
  const [otherCashiersByOrder, setOtherCashiersByOrder] = useState<
    Record<string, string[]>
  >({});

  // Mode panel aksi di kanan
  const [actionMode, setActionMode] = useState<
    "payment" | "revision" | "rebill" | "discount" | "cancel"
  >("payment");

  // State pembayaran tunai
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("");

  // State revisi item & Rebilling (Menu Habis)
  const [draftItems, setDraftItems] = useState<DraftRevisionItem[]>([]);
  const [revisionReason, setRevisionReason] = useState("");
  const [addProductId, setAddProductId] = useState<string>(
    initialData.products[0]?.id ?? ""
  );
  const [outOfStockProductIds, setOutOfStockProductIds] = useState<string[]>(
    []
  );
  const [rebillAlreadyPaid, setRebillAlreadyPaid] = useState<boolean>(true);
  const [rebillReason, setRebillReason] = useState<string>("Menu habis di outlet");

  // State diskon
  const [discountType, setDiscountType] = useState<
    "none" | "amount" | "percent"
  >("amount");
  const [discountValueInput, setDiscountValueInput] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");

  // State pembatalan & refund
  const [cancelCategory, setCancelCategory] =
    useState<RefundReasonCategory>("outlet_fault");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [showQrisPopup, setShowQrisPopup] = useState<boolean>(false);

  // Pop-up Order Baru Masuk & Alarm Aktif
  const [incomingOrderAlert, setIncomingOrderAlert] =
    useState<CashierOrderCardView | null>(null);

  // Deteksi order baru / klaim QRIS baru untuk bunyi notifikasi terus-menerus
  const prevPendingIdsRef = useRef<Set<string>>(
    new Set(initialData.pendingOrders.map((o) => o.id))
  );
  const prevClaimedIdsRef = useRef<Set<string>>(
    new Set(
      initialData.pendingOrders
        .filter((o) => Boolean(o.customerClaimedPaidAt))
        .map((o) => o.id)
    )
  );

  useEffect(() => {
    const currentPendingIds = new Set(
      initialData.pendingOrders.map((o) => o.id)
    );
    const currentClaimedIds = new Set(
      initialData.pendingOrders
        .filter((o) => Boolean(o.customerClaimedPaidAt))
        .map((o) => o.id)
    );

    let newlyClaimedOrder: CashierOrderCardView | undefined;
    let newlyCreatedOrder: CashierOrderCardView | undefined;

    for (const id of currentClaimedIds) {
      if (!prevClaimedIdsRef.current.has(id)) {
        newlyClaimedOrder = initialData.pendingOrders.find((o) => o.id === id);
        break;
      }
    }
    for (const id of currentPendingIds) {
      if (!prevPendingIdsRef.current.has(id)) {
        newlyCreatedOrder = initialData.pendingOrders.find((o) => o.id === id);
        break;
      }
    }

    if (soundEnabled && (newlyClaimedOrder || newlyCreatedOrder)) {
      const targetAlert = newlyClaimedOrder ?? newlyCreatedOrder!;
      setIncomingOrderAlert(targetAlert);
      orderAlarmService.start(Boolean(newlyClaimedOrder));
    }

    prevPendingIdsRef.current = currentPendingIds;
    prevClaimedIdsRef.current = currentClaimedIds;
  }, [initialData.pendingOrders, soundEnabled]);

  // Hentikan alarm saat komponen dilepas (unmount)
  useEffect(() => {
    return () => {
      orderAlarmService.stop();
    };
  }, []);

  const dismissAlarmOnly = useCallback(() => {
    orderAlarmService.stop();
  }, []);

  const handleDismissOrderAlert = useCallback(() => {
    orderAlarmService.stop();
    setIncomingOrderAlert(null);
  }, []);

  const allOrders = useMemo(
    () => [...initialData.pendingOrders, ...initialData.recentOrders],
    [initialData.pendingOrders, initialData.recentOrders]
  );

  const selectedOrder: CashierOrderCardView | null = useMemo(() => {
    if (!selectedOrderId) return null;
    return allOrders.find((o) => o.id === selectedOrderId) ?? null;
  }, [allOrders, selectedOrderId]);

  const selectOrder = useCallback((order: CashierOrderCardView) => {
    orderAlarmService.stop();
    setIncomingOrderAlert(null);
    setSelectedOrderId(order.id);
    setActionMode("payment");
    setCashReceivedInput(String(order.total));
    setDraftItems(
      order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        qty: item.qty,
        note: item.note ?? "",
      }))
    );
    setRevisionReason("");
    setDiscountType(order.discount > 0 ? "amount" : "amount");
    setDiscountValueInput(order.discount > 0 ? String(order.discount) : "");
    setDiscountReason(order.discountReason ?? "");
    setCancelCategory("outlet_fault");
    setCancelReason("");
  }, []);

  // Sinkronisasi default input ketika order yang dipilih berubah dari server
  useEffect(() => {
    if (!selectedOrder) {
      const fallback =
        activeTab === "pending"
          ? initialData.pendingOrders[0]
          : initialData.recentOrders[0];
      if (fallback) {
        selectOrder(fallback);
      }
      return;
    }
    setCashReceivedInput(String(selectedOrder.total));
  }, [
    selectedOrder,
    activeTab,
    initialData.pendingOrders,
    initialData.recentOrders,
    selectOrder,
  ]);

  // Langganan Supabase Realtime (orders + audit_logs + presence antar kasir)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const dbChannel = supabase
      .channel(`cashier-orders-${initialData.outlet.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `outlet_id=eq.${initialData.outlet.id}`,
        },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
          filter: `outlet_id=eq.${initialData.outlet.id}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    const presenceChannel = supabase.channel(
      `cashier-presence-${initialData.outlet.id}`,
      {
        config: {
          presence: {
            key: initialData.staff.userId,
          },
        },
      }
    );

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<PresencePayload>();
        const map: Record<string, string[]> = {};
        for (const [key, presences] of Object.entries(state)) {
          if (key === initialData.staff.userId) continue;
          for (const p of presences) {
            if (p.selectedOrderId) {
              const list = map[p.selectedOrderId] ?? [];
              if (!list.includes(p.fullName)) {
                list.push(p.fullName);
              }
              map[p.selectedOrderId] = list;
            }
          }
        }
        setOtherCashiersByOrder(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            userId: initialData.staff.userId,
            fullName: initialData.staff.fullName,
            selectedOrderId,
            updatedAt: new Date().toISOString(),
          });
        }
      });

    // Polling setiap 3 detik untuk memastikan order meja dan kedaluwarsa tampil real-time
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [
    initialData.outlet.id,
    initialData.staff.userId,
    initialData.staff.fullName,
    selectedOrderId,
    router,
  ]);

  const qrisClaimedPendingOrders = useMemo(
    () =>
      initialData.pendingOrders.filter((o) =>
        Boolean(o.customerClaimedPaidAt)
      ),
    [initialData.pendingOrders]
  );

  const displayedOrders = useMemo(() => {
    const sourceList =
      activeTab === "pending"
        ? initialData.pendingOrders
        : initialData.recentOrders;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        o.tableName.toLowerCase().includes(q) ||
        String(o.total).includes(q)
    );
  }, [
    activeTab,
    initialData.pendingOrders,
    initialData.recentOrders,
    searchQuery,
  ]);

  const parsedCashReceived = useMemo(() => {
    const clean = cashReceivedInput.replace(/[^\d]/g, "");
    return clean ? Number(clean) : 0;
  }, [cashReceivedInput]);

  const cashShortfall = selectedOrder
    ? Math.max(0, selectedOrder.total - parsedCashReceived)
    : 0;
  const cashChangePreview = selectedOrder
    ? Math.max(0, parsedCashReceived - selectedOrder.total)
    : 0;

  async function handleVerifyQrisPayment() {
    if (!selectedOrder) return;
    orderAlarmService.stop();
    setIncomingOrderAlert(null);
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await processOrderPaymentAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        method: "qris",
        amountReceived: selectedOrder.total,
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
        paidOrderId: res.orderId,
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAcceptCashPayment() {
    if (!selectedOrder) return;
    orderAlarmService.stop();
    setIncomingOrderAlert(null);
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await processOrderPaymentAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        method: "cash",
        amountReceived: parsedCashReceived,
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
        paidOrderId: res.orderId,
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleUpdateDraftQty(index: number, delta: number) {
    setDraftItems((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const newQty = target.qty + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index] = { ...target, qty: newQty };
      }
      return next;
    });
  }

  function handleAddProductToDraft() {
    if (!addProductId) return;
    const prod = initialData.products.find((p) => p.id === addProductId);
    if (!prod) return;

    setDraftItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === prod.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const curr = next[existingIdx];
        if (curr) {
          next[existingIdx] = { ...curr, qty: curr.qty + 1 };
        }
        return next;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          unitPrice: prod.price,
          qty: 1,
          note: "",
        },
      ];
    });
  }

  async function handleSaveRevision() {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await revisePendingOrderItemsAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        reason: revisionReason,
        items: draftItems.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          note: i.note.trim() || null,
        })),
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      if (res.ok) {
        setActionMode("payment");
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApplyDiscount(removeDiscount = false) {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const numericValue = removeDiscount
        ? 0
        : Number(discountValueInput.replace(/[^\d.]/g, "")) || 0;
      const res = await applyOrderDiscountAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        discountType: removeDiscount ? "none" : discountType,
        discountValue: numericValue,
        reason: discountReason,
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      if (res.ok) {
        setActionMode("payment");
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelOrder() {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await cancelOrderWithRefundAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        reasonCategory: cancelCategory,
        reason: cancelReason,
        outOfStockProductIds,
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      if (res.ok) {
        setActionMode("payment");
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRebillOrder() {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const alreadyPaidAmt =
        selectedOrder.status === "paid" ||
        selectedOrder.status === "ready" ||
        rebillAlreadyPaid
          ? selectedOrder.total
          : 0;

      const res = await rebillOrderAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        reason: rebillReason.trim() || "Menu habis — ganti pesanan",
        outOfStockProductIds,
        alreadyPaidAmount: alreadyPaidAmt,
        settleImmediately: alreadyPaidAmt > 0,
        settlementMethod:
          selectedOrder.payment?.method ?? selectedOrder.paymentChoice ?? "qris",
        items: draftItems.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          note: i.note.trim() || null,
        })),
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
        paidOrderId: res.orderId,
      });
      if (res.ok) {
        setActionMode("payment");
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelBecauseOutOfStock() {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const outNames = selectedOrder.items
        .filter((i) => outOfStockProductIds.includes(i.productId))
        .map((i) => i.productName);
      const reasonText =
        outNames.length > 0
          ? `Maaf, Menu Habis (${outNames.join(", ")}) — Silakan pilih menu lain`
          : rebillReason.trim() || "Maaf, menu yang dipesan sedang habis";

      const res = await cancelOrderWithRefundAction({
        orderId: selectedOrder.id,
        expectedVersion: selectedOrder.version,
        reasonCategory: "outlet_fault",
        reason: reasonText,
        outOfStockProductIds,
      });
      setFeedback({
        type: res.ok ? "success" : "error",
        text: res.message,
      });
      if (res.ok) {
        setActionMode("payment");
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Banner Notifikasi Real-time Konfirmasi QRIS dari Meja */}
      {qrisClaimedPendingOrders.length > 0 && (
        <div className="rounded-xl border-2 border-emerald-500 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-950 dark:text-emerald-200">
                <Bell className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                Notifikasi Pembayaran QRIS Masuk (
                {qrisClaimedPendingOrders.length} Meja Menunggu Verifikasi)
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Pelanggan menekan tombol &ldquo;Saya Sudah Bayar&rdquo;. Cocokkan{" "}
                <strong>Nomor Meja + Nominal Tagihan</strong> pada mutasi QRIS
                toko, lalu klik <strong>Pembayaran Sesuai</strong>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {qrisClaimedPendingOrders.map((ord) => (
                <Button
                  key={ord.id}
                  type="button"
                  size="sm"
                  onClick={() => {
                    setActiveTab("pending");
                    selectOrder(ord);
                  }}
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  {ord.tableName} • {formatRupiah(ord.total)} (#{ord.orderNo})
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          }`}
        >
          <span>{feedback.text}</span>
          <div className="flex flex-wrap items-center gap-2">
            {feedback.paidOrderId && (
              <>
                <Link href={`/struk/${feedback.paidOrderId}?autoprint=1`}>
                  <Button type="button" size="sm" variant="default">
                    <Printer className="mr-1.5 h-4 w-4" />
                    Cetak Struk Sekarang
                  </Button>
                </Link>
                <Link href={`/struk/${feedback.paidOrderId}`}>
                  <Button type="button" size="sm" variant="outline">
                    Lihat Struk
                  </Button>
                </Link>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFeedback(null)}
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {/* Header Bar Kasir */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "pending" ? "default" : "outline"}
            onClick={() => setActiveTab("pending")}
          >
            Menunggu Pembayaran ({initialData.pendingOrders.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === "history" ? "default" : "outline"}
            onClick={() => setActiveTab("history")}
          >
            Riwayat &amp; Status Order ({initialData.recentOrders.length})
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Cari no order / meja / nominal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-60"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playNotificationBeep(false);
            }}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="mr-1.5 h-4 w-4" />
                Suara Aktif
              </>
            ) : (
              <>
                <VolumeX className="mr-1.5 h-4 w-4" />
                Suara Mati
              </>
            )}
          </Button>
          <Link href="/order-manual">
            <Button type="button" variant="secondary">
              + Buat Order Manual
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid Utama 2 Kolom: Daftar Order (Kiri) & Detail + Aksi Pembayaran (Kanan) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Kolom Kiri: Daftar Kartu Order */}
        <div className="space-y-3 lg:col-span-5">
          {displayedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-zinc-500 dark:text-slate-400">
                {activeTab === "pending"
                  ? "Belum ada order yang menunggu pembayaran saat ini."
                  : "Belum ada riwayat order yang cocok."}
              </CardContent>
            </Card>
          ) : (
            displayedOrders.map((ord) => {
              const isSelected = selectedOrder?.id === ord.id;
              const isQrisClaimed =
                ord.status === "pending" && Boolean(ord.customerClaimedPaidAt);
              const openedByOthers = otherCashiersByOrder[ord.id] ?? [];

              return (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => selectOrder(ord)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-2 border-zinc-900 bg-zinc-50 shadow-sm dark:border-sky-500 dark:bg-slate-800/80"
                      : isQrisClaimed
                        ? "border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base font-bold text-zinc-900 dark:text-slate-100">
                          {ord.tableName}
                        </span>
                        <Badge variant="outline" className="font-mono">
                          #{ord.orderNo}
                        </Badge>
                        <Badge variant={STATUS_VARIANTS[ord.status]}>
                          {STATUS_LABELS[ord.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                        Masuk pukul {formatTimeWIB(ord.createdAt)} •{" "}
                        {ord.items.reduce((acc, i) => acc + i.qty, 0)} item •{" "}
                        {ord.source === "customer_qr"
                          ? "Scan QR Meja"
                          : "Input Kasir"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold text-zinc-900 dark:text-slate-100">
                        {formatRupiah(ord.total)}
                      </p>
                      <span className="text-xs font-medium text-zinc-600 dark:text-slate-400">
                        {ord.status === "pending"
                          ? ord.paymentChoice === "qris"
                            ? "Metode: QRIS Meja"
                            : "Metode: Tunai"
                          : ord.payment?.method === "qris"
                            ? "Dibayar: QRIS"
                            : "Dibayar: Tunai"}
                      </span>
                    </div>
                  </div>

                  {/* Badge Notifikasi Pelanggan Sudah Bayar QRIS */}
                  {isQrisClaimed && (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-emerald-400 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                      <Bell className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <span>
                        {ord.tableName} • Pelanggan Konfirmasi Sudah Bayar QRIS
                        • Cek Mutasi {formatRupiah(ord.total)}
                      </span>
                    </div>
                  )}

                  {/* Indikator dibuka kasir lain (Presence) */}
                  {openedByOthers.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                      <Eye className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span>Sedang dibuka oleh: {openedByOthers.join(", ")}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Kolom Kanan: Detail Order & Panel Tindakan Kasir */}
        <div className="lg:col-span-7">
          {!selectedOrder ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-zinc-500 dark:text-slate-400">
                Pilih salah satu order di sebelah kiri untuk memproses
                pembayaran, revisi item, diskon, atau cetak struk.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-zinc-100 dark:border-slate-800 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl">
                        {selectedOrder.tableName} — #{selectedOrder.orderNo}
                      </CardTitle>
                      <Badge variant={STATUS_VARIANTS[selectedOrder.status]}>
                        {STATUS_LABELS[selectedOrder.status]}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      Dibuat: {formatDateTimeWIB(selectedOrder.createdAt)} •
                      Versi Data: v{selectedOrder.version}
                    </CardDescription>
                  </div>

                  {/* Tombol Navigasi Mode Aksi */}
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrder.status === "pending" && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            actionMode === "payment" ? "default" : "outline"
                          }
                          onClick={() => setActionMode("payment")}
                        >
                          Pembayaran
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            actionMode === "revision" ? "default" : "outline"
                          }
                          onClick={() => {
                            setDraftItems(
                              selectedOrder.items.map((i) => ({
                                productId: i.productId,
                                productName: i.productName,
                                unitPrice: i.unitPrice,
                                qty: i.qty,
                                note: i.note ?? "",
                              }))
                            );
                            setActionMode("revision");
                          }}
                        >
                          Revisi Item
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            actionMode === "discount" ? "default" : "outline"
                          }
                          onClick={() => setActionMode("discount")}
                        >
                          Diskon
                        </Button>
                      </>
                    )}

                    {(selectedOrder.status === "pending" ||
                      selectedOrder.status === "paid" ||
                      selectedOrder.status === "ready") && (
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          actionMode === "rebill" ? "default" : "outline"
                        }
                        onClick={() => {
                          setDraftItems(
                            selectedOrder.items.map((i) => ({
                              productId: i.productId,
                              productName: i.productName,
                              unitPrice: i.unitPrice,
                              qty: i.qty,
                              note: i.note ?? "",
                            }))
                          );
                          setOutOfStockProductIds([]);
                          setRebillAlreadyPaid(
                            selectedOrder.status === "paid" ||
                              selectedOrder.status === "ready" ||
                              Boolean(selectedOrder.customerClaimedPaidAt)
                          );
                          setRebillReason("Menu habis di outlet");
                          setActionMode("rebill");
                        }}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Rebilling / Menu Habis
                      </Button>
                    )}

                    {selectedOrder.status !== "cancelled" &&
                      selectedOrder.status !== "expired" && (
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            actionMode === "cancel"
                              ? "destructive"
                              : "outline"
                          }
                          onClick={() => setActionMode("cancel")}
                        >
                          Batalkan / Refund
                        </Button>
                      )}

                    {selectedOrder.status !== "pending" &&
                      selectedOrder.status !== "expired" && (
                        <div className="flex items-center gap-1.5">
                          <Link href={`/struk/${selectedOrder.id}?autoprint=1`}>
                            <Button type="button" size="sm" variant="default">
                              <Printer className="mr-1.5 h-4 w-4" />
                              Cetak Struk
                            </Button>
                          </Link>
                          <Link href={`/struk/${selectedOrder.id}`}>
                            <Button type="button" size="sm" variant="secondary">
                              Lihat Struk
                            </Button>
                          </Link>
                        </div>
                      )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-4">
                {/* Daftar Item Pesanan Saat Ini */}
                {actionMode !== "revision" && (
                  <div className="rounded-xl border border-zinc-200 dark:border-slate-800 bg-zinc-50/60 dark:bg-slate-800/50 p-3.5">
                    <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
                      Rincian Item Pesanan
                    </h3>
                    <div className="divide-y divide-zinc-200/70 dark:divide-slate-700/70">
                      {selectedOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2 py-2 text-sm"
                        >
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-slate-100">
                              {item.qty}x {item.productName}
                            </span>
                            <span className="ml-2 text-xs text-zinc-500 dark:text-slate-400">
                              (@ {formatRupiah(item.unitPrice)})
                            </span>
                            {item.note && (
                              <p className="text-xs italic text-zinc-600 dark:text-slate-400">
                                Catatan: &ldquo;{item.note}&rdquo;
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-zinc-900 dark:text-slate-100">
                            {formatRupiah(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Ringkasan Angka Tagihan */}
                    <div className="mt-3 space-y-1 border-t border-zinc-200 dark:border-slate-700 pt-3 text-sm">
                      <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span>{formatRupiah(selectedOrder.subtotal)}</span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                          <span>
                            Diskon{" "}
                            {selectedOrder.discountReason
                              ? `(${selectedOrder.discountReason})`
                              : ""}
                          </span>
                          <span>- {formatRupiah(selectedOrder.discount)}</span>
                        </div>
                      )}
                      {selectedOrder.serviceAmount > 0 && (
                        <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                          <span>
                            Service Charge ({selectedOrder.serviceRate ?? 0}%)
                          </span>
                          <span>
                            {formatRupiah(selectedOrder.serviceAmount)}
                          </span>
                        </div>
                      )}
                      {selectedOrder.taxAmount > 0 && (
                        <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                          <span>
                            Pajak Restoran ({selectedOrder.taxRate ?? 0}%
                            {selectedOrder.priceIncludesTax
                              ? " • Termasuk"
                              : ""}
                            )
                          </span>
                          <span>{formatRupiah(selectedOrder.taxAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-zinc-200 dark:border-slate-700 pt-2 text-base font-extrabold text-zinc-900 dark:text-slate-100">
                        <span>Total Tagihan</span>
                        <span>{formatRupiah(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* PANEL 1: PEMBAYARAN (QRIS & TUNAI) */}
                {selectedOrder.status === "pending" &&
                  actionMode === "payment" && (
                    <div className="space-y-4">
                      {/* Kotak Verifikasi QRIS di Meja */}
                      <div
                        className={`rounded-xl border-2 p-4 ${
                          selectedOrder.customerClaimedPaidAt
                            ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-600 dark:bg-emerald-950/30"
                            : "border-zinc-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-slate-100">
                              Opsi 1 — Verifikasi Pembayaran QRIS di Meja
                            </h4>
                            <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
                              Cocokkan uang masuk pada aplikasi merchant QRIS
                              untuk{" "}
                              <strong className="text-zinc-900 dark:text-slate-100">
                                {selectedOrder.tableName}
                              </strong>{" "}
                              sebesar{" "}
                              <strong className="text-zinc-900 dark:text-slate-100">
                                {formatRupiah(selectedOrder.total)}
                              </strong>{" "}
                              (nominal murni tanpa tambahan angka unik).
                            </p>
                          </div>
                          {selectedOrder.customerClaimedPaidAt ? (
                            <Badge variant="success">
                              Pelanggan Klik &ldquo;Saya Sudah Bayar&rdquo; (
                              {formatTimeWIB(
                                selectedOrder.customerClaimedPaidAt
                              )}
                              )
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Pilihan Awal:{" "}
                              {selectedOrder.paymentChoice === "qris"
                                ? "QRIS di Meja"
                                : "Tunai di Kasir"}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSubmitting}
                            onClick={() => setShowQrisPopup(true)}
                            className="border-sky-300 bg-sky-50 font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
                          >
                            <QrCode className="mr-1.5 h-4 w-4" />
                            Tampilkan Popup QRIS Tagihan
                          </Button>
                          <Button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleVerifyQrisPayment}
                            className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            {isSubmitting
                              ? "Memproses..."
                              : `Pembayaran Sesuai — Terima QRIS (${selectedOrder.tableName} • ${formatRupiah(selectedOrder.total)})`}
                          </Button>
                        </div>
                      </div>

                      {/* Kotak Penerimaan Tunai di Kasir */}
                      <div className="rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-slate-100">
                          Opsi 2 — Pembayaran Tunai di Kasir
                        </h4>
                        <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
                          Masukkan nominal uang tunai yang diterima dari
                          pelanggan. Sistem menghitung kembalian otomatis.
                        </p>

                        {/* Tombol Cepat Nominal */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setCashReceivedInput(String(selectedOrder.total))
                            }
                          >
                            Uang Pas ({formatRupiah(selectedOrder.total)})
                          </Button>
                          {[50000, 100000, 150000, 200000].map((preset) => (
                            <Button
                              key={preset}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setCashReceivedInput(String(preset))
                              }
                            >
                              {formatRupiah(preset)}
                            </Button>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-slate-300">
                              Uang Diterima (Rp)
                            </label>
                            <Input
                              type="number"
                              min={0}
                              step={500}
                              value={cashReceivedInput}
                              onChange={(e) =>
                                setCashReceivedInput(e.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-col justify-center rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/70 px-3 py-2">
                            <span className="text-xs text-zinc-500 dark:text-slate-400">
                              {cashShortfall > 0
                                ? "Kurang Bayar"
                                : "Uang Kembalian"}
                            </span>
                            <span
                              className={`text-lg font-extrabold ${
                                cashShortfall > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {cashShortfall > 0
                                ? `- ${formatRupiah(cashShortfall)}`
                                : formatRupiah(cashChangePreview)}
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          disabled={isSubmitting || cashShortfall > 0}
                          onClick={handleAcceptCashPayment}
                          className="mt-3 w-full"
                        >
                          <Banknote className="mr-1.5 h-4 w-4" />
                          {isSubmitting
                            ? "Memproses..."
                            : `Bayar Tunai (${formatRupiah(selectedOrder.total)})`}
                        </Button>
                      </div>
                    </div>
                  )}

                {/* PANEL 2: REVISI ITEM ORDER (Hanya saat PENDING) */}
                {selectedOrder.status === "pending" &&
                  actionMode === "revision" && (
                    <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-slate-100">
                          Revisi Item Pesanan (Sebelum Dibayar)
                        </h4>
                        <p className="text-xs text-zinc-600 dark:text-slate-400">
                          Ubah jumlah, hapus item, atau tambah produk. Kondisi
                          sebelum &amp; sesudah revisi tercatat otomatis di
                          Jejak Audit.
                        </p>
                      </div>

                      <div className="divide-y divide-zinc-200 dark:divide-slate-800 rounded-lg border border-zinc-200 dark:border-slate-800">
                        {draftItems.map((item, idx) => (
                          <div
                            key={`${item.productId}-${idx}`}
                            className="space-y-2 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-slate-100">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-slate-400">
                                  {formatRupiah(item.unitPrice)} / porsi
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateDraftQty(idx, -1)}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center text-sm font-bold">
                                  {item.qty}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateDraftQty(idx, 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            <Input
                              type="text"
                              placeholder="Catatan item (opsional)..."
                              value={item.note}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftItems((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, note: val } : row
                                  )
                                );
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Tambah Produk ke Order */}
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Pilih produk tambahan"
                          value={addProductId}
                          onChange={(e) => setAddProductId(e.target.value)}
                          className="h-11 flex-1 rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-zinc-900 dark:text-slate-100"
                        >
                          {initialData.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatRupiah(p.price)}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddProductToDraft}
                        >
                          + Tambah Produk
                        </Button>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300">
                          Alasan Revisi (Wajib)
                        </label>
                        <Input
                          type="text"
                          placeholder="Contoh: Pelanggan minta ganti ukuran / kurangi 1 porsi"
                          value={revisionReason}
                          onChange={(e) => setRevisionReason(e.target.value)}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setActionMode("payment")}
                        >
                          Batal
                        </Button>
                        <Button
                          type="button"
                          disabled={
                            isSubmitting ||
                            draftItems.length === 0 ||
                            revisionReason.trim().length < 3
                          }
                          onClick={handleSaveRevision}
                        >
                          Simpan Revisi Order
                        </Button>
                      </div>
                    </div>
                  )}

                {/* PANEL 2B: MEKANISME REBILLING / MENU HABIS */}
                {actionMode === "rebill" && (
                  <div className="space-y-4 rounded-xl border-2 border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/30 p-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Mekanisme Rebilling &amp; Penanganan Menu Habis
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        Gunakan fitur ini ketika pelanggan sudah memesan
                        (termasuk sudah transfer QRIS), tetapi menu yang dipesan
                        ternyata <strong>Habis</strong>. Anda dapat langsung
                        menandai menu tersebut habis, lalu memilih{" "}
                        <strong>Ganti Menu (Rebilling)</strong> dengan hitungan
                        selisih uang otomatis, atau{" "}
                        <strong>Batalkan &amp; Kembalikan Uang</strong>.
                      </p>
                    </div>

                    {/* Langkah 1: Tandai Menu yang Habis */}
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
                      <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                        1. Centang Menu yang Habis (Otomatis Nonaktif di Buku
                        Menu Pelanggan):
                      </p>
                      <div className="space-y-1.5">
                        {selectedOrder.items.map((item) => {
                          const isChecked = outOfStockProductIds.includes(
                            item.productId
                          );
                          return (
                            <label
                              key={item.id}
                              className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                            >
                              <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setOutOfStockProductIds((prev) =>
                                      checked
                                        ? [...prev, item.productId]
                                        : prev.filter(
                                            (id) => id !== item.productId
                                          )
                                    );
                                    if (checked) {
                                      setDraftItems((prev) =>
                                        prev.filter(
                                          (d) => d.productId !== item.productId
                                        )
                                      );
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                                />
                                {item.qty}x {item.productName} (
                                {formatRupiah(item.unitPrice)})
                              </span>
                              <Badge
                                variant={isChecked ? "destructive" : "outline"}
                              >
                                {isChecked
                                  ? "Ditandai Habis & Dihapus dari Order"
                                  : "Tersedia"}
                              </Badge>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Langkah 2: Daftar Item Pengganti untuk Rebilling */}
                    <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        2. Daftar Menu Pengganti (Jika Pelanggan Ingin Tukar
                        Pesanan):
                      </p>
                      {draftItems.length === 0 ? (
                        <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
                          Semua item dihapus. Tambahkan menu pengganti di bawah,
                          atau klik{" "}
                          <strong>Batal Penuh (Info Menu Habis)</strong> jika
                          pelanggan tidak jadi memesan.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                          {draftItems.map((item, idx) => (
                            <div
                              key={`${item.productId}-${idx}`}
                              className="flex items-center justify-between gap-2 p-2.5"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatRupiah(item.unitPrice)} / porsi
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateDraftQty(idx, -1)}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center text-sm font-bold">
                                  {item.qty}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateDraftQty(idx, 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <select
                          aria-label="Pilih menu pengganti"
                          value={addProductId}
                          onChange={(e) => setAddProductId(e.target.value)}
                          className="h-10 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100"
                        >
                          {initialData.products
                            .filter(
                              (p) => !outOfStockProductIds.includes(p.id)
                            )
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {formatRupiah(p.price)}
                              </option>
                            ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleAddProductToDraft}
                        >
                          + Tambah Menu Pengganti
                        </Button>
                      </div>
                    </div>

                    {/* Langkah 3: Kalkulator Selisih Uang Rebilling Otomatis */}
                    {(() => {
                      const newDraftSubtotal = draftItems.reduce(
                        (s, i) => s + i.unitPrice * i.qty,
                        0
                      );
                      const initialPaidAmt =
                        selectedOrder.status === "paid" ||
                        selectedOrder.status === "ready" ||
                        rebillAlreadyPaid
                          ? selectedOrder.total
                          : 0;
                      const diff = newDraftSubtotal - initialPaidAmt;

                      return (
                        <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              3. Perhitungan Uang &amp; Selisih Rebilling:
                            </span>
                            {selectedOrder.status === "pending" && (
                              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={rebillAlreadyPaid}
                                  onChange={(e) =>
                                    setRebillAlreadyPaid(e.target.checked)
                                  }
                                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                                />
                                Pelanggan Sudah Transfer QRIS Awal (
                                {formatRupiah(selectedOrder.total)})
                              </label>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                            <div className="rounded-md bg-slate-50 dark:bg-slate-800/70 p-2.5">
                              <span className="block text-slate-500 dark:text-slate-400">
                                Uang Sudah Masuk
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {formatRupiah(initialPaidAmt)}
                              </span>
                            </div>
                            <div className="rounded-md bg-slate-50 dark:bg-slate-800/70 p-2.5">
                              <span className="block text-slate-500 dark:text-slate-400">
                                Total Menu Pengganti
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {formatRupiah(newDraftSubtotal)}
                              </span>
                            </div>
                            <div
                              className={`rounded-md p-2.5 ${
                                diff === 0
                                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                                  : diff < 0
                                    ? "bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200"
                                    : "bg-sky-50 text-sky-950 dark:bg-sky-950/50 dark:text-sky-200"
                              }`}
                            >
                              <span className="block font-medium">
                                {diff === 0
                                  ? "Selisih Pas"
                                  : diff < 0
                                    ? "Kembalian Kasir ke Pelanggan"
                                    : "Pelanggan Tambah Bayar"}
                              </span>
                              <span className="text-sm font-extrabold">
                                {diff === 0
                                  ? "Rp 0 (Harga Sama)"
                                  : formatRupiah(Math.abs(diff))}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Catatan / Alasan Rebilling
                      </label>
                      <Input
                        type="text"
                        value={rebillReason}
                        onChange={(e) => setRebillReason(e.target.value)}
                        placeholder="Contoh: Menu habis — ditukar pelanggan ke menu pengganti"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={handleCancelBecauseOutOfStock}
                      >
                        Batal Penuh (Info Menu Habis &amp; Kembalikan Uang)
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setActionMode("payment")}
                        >
                          Tutup
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            isSubmitting ||
                            draftItems.length === 0 ||
                            rebillReason.trim().length < 3
                          }
                          onClick={handleRebillOrder}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Proses Rebilling &amp; Masuk Kitchen
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PANEL 3: DISKON ORDER (Hanya saat PENDING) */}
                {selectedOrder.status === "pending" &&
                  actionMode === "discount" && (
                    <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-slate-100">
                          Pengaturan Diskon Order
                        </h4>
                        <p className="text-xs text-zinc-600 dark:text-slate-400">
                          Setiap pemberian diskon wajib disertai alasan dan
                          dicatat di Jejak Audit.
                          {initialData.outlet.maxCashierDiscountPercent !==
                            null &&
                            ` Batas diskon Kasir: maks ${initialData.outlet.maxCashierDiscountPercent}%.`}
                          {initialData.outlet.maxCashierDiscountAmount !==
                            null &&
                            ` Maks ${formatRupiah(initialData.outlet.maxCashierDiscountAmount)}.`}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            discountType === "amount" ? "default" : "outline"
                          }
                          onClick={() => setDiscountType("amount")}
                        >
                          Nominal Rupiah (Rp)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            discountType === "percent" ? "default" : "outline"
                          }
                          onClick={() => setDiscountType("percent")}
                        >
                          Persentase (%)
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300">
                            {discountType === "amount"
                              ? "Nominal Diskon (Rp)"
                              : "Persentase Diskon (%)"}
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={discountValueInput}
                            onChange={(e) =>
                              setDiscountValueInput(e.target.value)
                            }
                            placeholder={
                              discountType === "amount" ? "10000" : "10"
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300">
                            Alasan Diskon (Wajib)
                          </label>
                          <Input
                            type="text"
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                            placeholder="Contoh: Promo Member / Kompensasi"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-between gap-2">
                        {selectedOrder.discount > 0 ? (
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={isSubmitting}
                            onClick={() => handleApplyDiscount(true)}
                          >
                            Hapus Diskon Saat Ini
                          </Button>
                        ) : (
                          <span />
                        )}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActionMode("payment")}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            disabled={
                              isSubmitting || discountReason.trim().length < 3
                            }
                            onClick={() => handleApplyDiscount(false)}
                          >
                            Terapkan Diskon
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                {/* PANEL 4: PEMBATALAN ORDER & REFUND */}
                {actionMode === "cancel" && (
                  <div className="space-y-4 rounded-xl border-2 border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/30 p-4">
                    <div>
                      <h4 className="text-sm font-bold text-red-950 dark:text-red-200">
                        Pembatalan Order &amp; Pencatatan Refund
                      </h4>
                      <p className="mt-0.5 text-xs text-red-800 dark:text-red-300">
                        {selectedOrder.status === "pending"
                          ? "Order masih PENDING (belum dibayar). Pembatalan akan menghentikan pesanan tanpa catatan refund uang."
                          : selectedOrder.status === "served"
                            ? "PERHATIAN: Order berstatus SERVED (sudah disajikan). Sesuai aturan bisnis, hanya OWNER yang dapat membatalkan order ini, dan hanya untuk Kesalahan Outlet."
                            : `Order sudah dibayar (${formatRupiah(selectedOrder.total)}). Pembatalan akan otomatis membuat catatan Refund Tunai.`}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-800 dark:text-slate-200">
                        Kategori Alasan Pembatalan
                      </label>
                      <select
                        aria-label="Kategori alasan pembatalan"
                        value={cancelCategory}
                        onChange={(e) =>
                          setCancelCategory(
                            e.target.value as RefundReasonCategory
                          )
                        }
                        className="h-11 w-full rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-zinc-900 dark:text-slate-100"
                      >
                        <option value="outlet_fault">
                          Kesalahan Outlet (Bahan habis / salah masak / kualitas)
                        </option>
                        <option value="other">
                          Alasan Lainnya (Batal sebelum masak / permintaan
                          khusus)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-800 dark:text-slate-200">
                        Keterangan Alasan Lengkap (Wajib)
                      </label>
                      <Input
                        type="text"
                        placeholder="Jelaskan alasan pembatalan secara spesifik..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActionMode("payment")}
                      >
                        Kembali
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={
                          isSubmitting || cancelReason.trim().length < 3
                        }
                        onClick={handleCancelOrder}
                      >
                        {selectedOrder.status === "pending"
                          ? "Konfirmasi Batalkan Order"
                          : `Batalkan & Catat Refund ${formatRupiah(selectedOrder.total)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {/* RINGKASAN PEMBAYARAN & REFUND UNTUK ORDER YANG SUDAH SELESAI / DIBATALKAN */}
                {selectedOrder.payment && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-950 dark:text-emerald-200">
                    <p className="font-bold">
                      Informasi Pembayaran Sah (
                      {selectedOrder.payment.method === "qris"
                        ? "QRIS di Meja"
                        : "Tunai di Kasir"}
                      )
                    </p>
                    <p className="mt-1">
                      Diterima:{" "}
                      <strong>
                        {formatRupiah(selectedOrder.payment.amountReceived)}
                      </strong>{" "}
                      • Kembalian:{" "}
                      <strong>
                        {formatRupiah(selectedOrder.payment.changeAmount)}
                      </strong>{" "}
                      • Waktu: {formatDateTimeWIB(selectedOrder.payment.createdAt)}
                    </p>
                  </div>
                )}

                {selectedOrder.refund && (
                  <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-950 dark:text-red-200">
                    <p className="font-bold">
                      Catatan Refund Tunai:{" "}
                      {formatRupiah(selectedOrder.refund.amount)}
                    </p>
                    <p className="mt-1">
                      Kategori:{" "}
                      <strong>
                        {selectedOrder.refund.reasonCategory === "outlet_fault"
                          ? "Kesalahan Outlet"
                          : "Lainnya"}
                      </strong>{" "}
                      • Alasan: &ldquo;{selectedOrder.refund.reason}&rdquo;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* POPUP MODAL QRIS TAGIHAN DI LAYAR KASIR */}
      {showQrisPopup && selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isSubmitting) setShowQrisPopup(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <Badge className="mb-1 bg-[#1E88E5] text-white">
                  QRIS TAGIHAN ORDER #{selectedOrder.orderNo}
                </Badge>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {initialData.outlet.qrisMerchantName ||
                    initialData.outlet.name}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedOrder.tableName}
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowQrisPopup(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                aria-label="Tutup Popup QRIS"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-center">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 py-2.5 px-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Nominal Tagihan QRIS
                </p>
                <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200">
                  {formatRupiah(selectedOrder.total)}
                </p>
              </div>

              <div className="mx-auto flex w-fit flex-col items-center justify-center rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-sm">
                {(initialData.outlet.qrisRawPayload ?? "")
                  .trim()
                  .startsWith("data:image/") ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={(initialData.outlet.qrisRawPayload ?? "").trim()}
                    alt="QRIS Toko"
                    className="h-64 w-64 object-contain"
                  />
                ) : (
                  <div
                    className="h-64 w-64"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const raw = (
                          initialData.outlet.qrisRawPayload ?? ""
                        ).trim();
                        const source = raw.startsWith("000201")
                          ? raw
                          : DEFAULT_FALLBACK_STATIC_QRIS;
                        try {
                          return generateQrSvgString(source, 2);
                        } catch {
                          return generateQrSvgString(
                            DEFAULT_FALLBACK_STATIC_QRIS,
                            2
                          );
                        }
                      })(),
                    }}
                  />
                )}
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 text-center text-xs text-emerald-950 dark:text-emerald-200">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  Ketik / Pastikan Nominal Tagihan: {formatRupiah(selectedOrder.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                  Arahkan pelanggan scan QRIS di atas dengan m-Banking / e-Wallet (BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, Dana, dll) dan ketik nominal tagihan di atas.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setShowQrisPopup(false)}
                className="min-h-11 sm:w-1/3"
              >
                Tutup
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  await handleVerifyQrisPayment();
                  setShowQrisPopup(false);
                }}
                className="min-h-11 flex-1 bg-emerald-700 font-bold text-white hover:bg-emerald-800"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {isSubmitting
                  ? "Memproses..."
                  : "Pembayaran QRIS Sesuai — Terima Order"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL PESANAN BARU / KLAIM QRIS MASUK DARI MEJA */}
      {incomingOrderAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border-2 border-emerald-500 dark:border-emerald-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 animate-pulse">
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {incomingOrderAlert.customerClaimedPaidAt
                      ? "Konfirmasi Pembayaran QRIS Masuk!"
                      : "Pesanan Baru Masuk dari Meja!"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {incomingOrderAlert.customerClaimedPaidAt
                      ? "Pelanggan telah menekan tombol 'Saya Sudah Bayar' pada layar meja."
                      : "Pelanggan baru saja mengirim pesanan dari layar meja."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissOrderAlert}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Tutup Notifikasi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 text-sm border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Nomor Meja</p>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">
                    {incomingOrderAlert.tableNo
                      ? `Meja ${incomingOrderAlert.tableNo}`
                      : "Takeaway / Manual"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Nomor Order</p>
                  <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                    #{incomingOrderAlert.orderNo}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Metode</p>
                  <Badge variant="outline" className="mt-0.5 font-bold uppercase text-[11px]">
                    {incomingOrderAlert.paymentChoice === "qris"
                      ? "QRIS di Meja"
                      : "Tunai di Kasir"}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tagihan</p>
                  <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                    {formatRupiah(incomingOrderAlert.total)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rincian Item ({incomingOrderAlert.items.reduce((acc, it) => acc + it.qty, 0)} item):
                </p>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-2.5 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {incomingOrderAlert.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {item.qty}x {item.productName}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {formatRupiah(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={dismissAlarmOnly}
                className="min-h-11 sm:w-1/3 border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <VolumeX className="mr-1.5 h-4 w-4" />
                Matikan Alarm
              </Button>
              <Button
                type="button"
                onClick={() => {
                  selectOrder(incomingOrderAlert);
                  setActiveTab("pending");
                  handleDismissOrderAlert();
                }}
                className="min-h-11 flex-1 bg-emerald-700 font-bold text-white hover:bg-emerald-800 shadow-sm"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Terima Pesanan &amp; Buka Order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
