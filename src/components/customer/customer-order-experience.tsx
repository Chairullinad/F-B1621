"use client";

import * as React from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTimeWIB } from "@/lib/datetime";
import { calculateOrderTotals, formatRupiah } from "@/lib/money";
import type { PaymentMethod, ProductRow } from "@/lib/types/database";
import {
  confirmCustomerQrisPaidAction,
  createCustomerOrderAction,
  getCustomerOrderStatusAction,
  type CustomerOrderTrackingView,
  type CustomerTablePublicData,
} from "@/server/customer-order";
import {
  CustomerCheckoutDetail,
  type CustomerCartItem,
} from "./customer-checkout-detail";
import { CustomerLandingPage } from "./customer-landing-page";
import { CustomerMenuItemCard } from "./customer-menu-item-card";

function generateClientIdempotencyKey(tableNo: number): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `tbl${tableNo}-${Date.now()}-${rand}`;
}

function formatRemainingCountdown(expiresAtIso: string | null, nowMs: number): {
  expired: boolean;
  formatted: string;
} {
  if (!expiresAtIso) {
    return { expired: false, formatted: "15:00" };
  }
  const diffSec = Math.max(
    0,
    Math.floor((new Date(expiresAtIso).getTime() - nowMs) / 1000)
  );
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return {
    expired: diffSec <= 0,
    formatted: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
  };
}

function playCustomerStatusChime(isAlert = false) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(isAlert ? [200, 100, 200] : [120, 60, 140]);
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isAlert ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(isAlert ? 360 : 587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(
      isAlert ? 260 : 880,
      ctx.currentTime + 0.14
    );
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch {
    // Abaikan jika browser memblokir audio
  }
}

export function CustomerOrderExperience({
  data,
}: {
  data: CustomerTablePublicData;
}) {
  const storageKey = `pos1621_active_order_${data.table.qrToken}`;

  const [viewStep, setViewStep] = React.useState<"landing" | "menu" | "detail">(
    "landing"
  );
  const [menuSheetOpen, setMenuSheetOpen] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] =
    React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cart, setCart] = React.useState<CustomerCartItem[]>([]);
  const [paymentChoice, setPaymentChoice] = React.useState<PaymentMethod>(() =>
    data.outlet.isQrisUnderMaintenance ? "cash" : "qris"
  );
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>(() =>
    generateClientIdempotencyKey(data.table.tableNo)
  );

  const [activeOrder, setActiveOrder] =
    React.useState<CustomerOrderTrackingView | null>(null);
  const prevStatusRef = React.useRef<string | null>(null);
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  const [servedExpireCountdown, setServedExpireCountdown] = React.useState<
    number | null
  >(null);
  const [isPending, startTransition] = React.useTransition();

  // Muat order aktif dari sessionStorage jika pelanggan me-refresh halaman
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const savedOrderId = window.sessionStorage.getItem(storageKey);
    if (!savedOrderId) return;

    void (async () => {
      const res = await getCustomerOrderStatusAction({
        qrToken: data.table.qrToken,
        orderId: savedOrderId,
      });
      if (res.ok && res.order) {
        setActiveOrder(res.order);
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    })();
  }, [data.table.qrToken, storageKey]);

  // Kembalikan ke menu jika keranjang dikosongkan dari halaman Detail Pesanan
  React.useEffect(() => {
    if (viewStep === "detail" && cart.length === 0) {
      setViewStep("menu");
    }
  }, [cart.length, viewStep]);

  // Timer 1 detik untuk hitung mundur 15 menit
  React.useEffect(() => {
    if (!activeOrder || activeOrder.status !== "pending") return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeOrder]);

  // Deteksi perubahan status pesanan di layar pelanggan untuk notifikasi audio & getar
  React.useEffect(() => {
    if (!activeOrder) {
      prevStatusRef.current = null;
      return;
    }
    const prev = prevStatusRef.current;
    const curr = activeOrder.status;
    if (prev && prev !== curr) {
      if (curr === "paid") {
        playCustomerStatusChime(false);
        toast.success(
          "Pembayaran Anda telah diverifikasi Kasir! Pesanan sedang dimasak di Kitchen."
        );
      } else if (curr === "ready") {
        playCustomerStatusChime(false);
        toast.success(
          `Pesanan Anda sudah selesai dimasak dan sedang diantar ke ${activeOrder.tableName}!`
        );
      } else if (curr === "served") {
        playCustomerStatusChime(false);
        toast.success("Pesanan sudah diantar ke meja. Selamat menikmati!");
      } else if (curr === "cancelled" || curr === "expired") {
        playCustomerStatusChime(true);
        toast.error(
          activeOrder.cancelReason
            ? `Pesanan dibatalkan: ${activeOrder.cancelReason}`
            : "Pesanan Anda telah dibatalkan / kedaluwarsa."
        );
      }
    }
    prevStatusRef.current = curr;
  }, [activeOrder]);

  // Polling status order setiap 3 detik selama order aktif dan belum expired sesinya
  React.useEffect(() => {
    if (!activeOrder || activeOrder.sessionExpired) return;
    if (
      activeOrder.status === "expired" ||
      activeOrder.status === "cancelled"
    ) {
      return;
    }

    const pollInterval = window.setInterval(async () => {
      const res = await getCustomerOrderStatusAction({
        qrToken: data.table.qrToken,
        orderId: activeOrder.orderId,
      });
      if (res.ok && res.order) {
        setActiveOrder(res.order);
      }
    }, 3000);

    return () => window.clearInterval(pollInterval);
  }, [activeOrder, data.table.qrToken]);

  // Begitu status mencapai SERVED, hitung mundur 8 detik lalu kunci sesi otomatis
  React.useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === "served" && !activeOrder.sessionExpired) {
      setServedExpireCountdown((prev) => (prev === null ? 8 : prev));
      const timer = window.setInterval(() => {
        setServedExpireCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            window.clearInterval(timer);
            void (async () => {
              const res = await getCustomerOrderStatusAction({
                qrToken: data.table.qrToken,
                orderId: activeOrder.orderId,
                acknowledgeServed: true,
              });
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(storageKey);
              }
              if (res.ok && res.order) {
                setActiveOrder(res.order);
              } else {
                setActiveOrder((curr) =>
                  curr ? { ...curr, sessionExpired: true } : null
                );
              }
            })();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => window.clearInterval(timer);
    }
  }, [activeOrder, data.table.qrToken, storageKey]);

  const categoryNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data.categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [data.categories]);

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.products.filter((p) => {
      if (selectedCategoryId !== "ALL" && p.category_id !== selectedCategoryId) {
        return false;
      }
      if (q.length > 0 && !p.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data.products, selectedCategoryId, searchQuery]);

  // Pengelompokan produk per kategori untuk tampilan katalog ala e-menu modern
  const groupedSections = React.useMemo(() => {
    const sections: Array<{
      id: string;
      title: string;
      items: ProductRow[];
    }> = [];

    if (selectedCategoryId !== "ALL" || searchQuery.trim().length > 0) {
      if (filteredProducts.length > 0) {
        const title =
          selectedCategoryId !== "ALL"
            ? categoryNameMap.get(selectedCategoryId) ?? "Daftar Menu"
            : `Hasil Pencarian "${searchQuery.trim()}"`;
        sections.push({
          id: "filtered",
          title,
          items: filteredProducts,
        });
      }
      return sections;
    }

    const usedIds = new Set<string>();
    for (const cat of data.categories) {
      const catItems = data.products.filter((p) => p.category_id === cat.id);
      if (catItems.length > 0) {
        sections.push({
          id: cat.id,
          title: cat.name,
          items: catItems,
        });
        for (const it of catItems) {
          usedIds.add(it.id);
        }
      }
    }

    const remaining = data.products.filter((p) => !usedIds.has(p.id));
    if (remaining.length > 0) {
      sections.push({
        id: "others",
        title: "Menu Lainnya",
        items: remaining,
      });
    }

    return sections;
  }, [
    data.categories,
    data.products,
    filteredProducts,
    selectedCategoryId,
    searchQuery,
    categoryNameMap,
  ]);

  const cartTotals = React.useMemo(() => {
    if (cart.length === 0) {
      return null;
    }
    return calculateOrderTotals({
      items: cart.map((c) => ({
        unitPrice: c.product.price,
        qty: c.qty,
      })),
      config: data.outlet.taxConfig,
    });
  }, [cart, data.outlet.taxConfig]);

  const totalItemsInCart = React.useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  function addToCart(product: ProductRow) {
    if (!product.is_available) return;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx === -1) {
        return [...prev, { product, qty: 1, note: "" }];
      }
      return prev.map((item, i) =>
        i === idx ? { ...item, qty: Math.min(50, item.qty + 1) } : item
      );
    });
  }

  function updateCartQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, qty: item.qty + delta }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function updateCartNote(productId: string, note: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, note } : item
      )
    );
  }

  function handleJumpToCategory(categoryId: string) {
    setMenuSheetOpen(false);
    if (categoryId === "ALL") {
      setSelectedCategoryId("ALL");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (selectedCategoryId === "ALL" && searchQuery.trim().length === 0) {
      const el = document.getElementById(`menu-section-${categoryId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    setSelectedCategoryId(categoryId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmitOrder() {
    if (cart.length === 0) {
      toast.error("Pilih minimal 1 menu terlebih dahulu.");
      setViewStep("menu");
      return;
    }

    const effectivePaymentChoice: PaymentMethod =
      data.outlet.isQrisUnderMaintenance ? "cash" : paymentChoice;

    startTransition(async () => {
      const res = await createCustomerOrderAction({
        qrToken: data.table.qrToken,
        paymentChoice: effectivePaymentChoice,
        idempotencyKey,
        items: cart.map((c) => ({
          productId: c.product.id,
          qty: c.qty,
          note: c.note.trim() || null,
        })),
      });

      if (!res.ok || !res.order) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setCart([]);
      setViewStep("menu");
      setIdempotencyKey(generateClientIdempotencyKey(data.table.tableNo));
      setActiveOrder(res.order);
      setNowMs(Date.now());
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, res.order.orderId);
      }
    });
  }

  function handleConfirmQrisPaid() {
    if (!activeOrder) return;
    startTransition(async () => {
      const res = await confirmCustomerQrisPaidAction({
        qrToken: data.table.qrToken,
        orderId: activeOrder.orderId,
      });
      if (!res.ok || !res.order) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setActiveOrder(res.order);
    });
  }

  function handleStartNewOrder() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(storageKey);
    }
    setActiveOrder(null);
    setViewStep("landing");
    setServedExpireCountdown(null);
    setIdempotencyKey(generateClientIdempotencyKey(data.table.tableNo));
  }

  // ==========================================================================
  // TAMPILAN 1: SESI PEMANTAUAN SUDAH BERAKHIR (SETELAH DISAJIKAN / SERVED)
  // ==========================================================================
  if (activeOrder && activeOrder.sessionExpired) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md rounded-2xl border-2 border-[#00884A] bg-white shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#00884A] text-lg font-bold text-white">
              ✓
            </div>
            <CardTitle className="text-xl text-slate-900">
              Sesi Pesanan #{activeOrder.orderNo} Telah Selesai
            </CardTitle>
            <CardDescription className="text-slate-600">
              Pesanan Anda di <strong>{activeOrder.tableName}</strong> sudah
              selesai disajikan dan halaman pemantauan pesanan ini telah
              berakhir (<em>expired</em>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-[#00884A] hover:bg-[#00733E] text-white font-bold"
              onClick={handleStartNewOrder}
            >
              Pesan Menu Tambahan di {data.table.name}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ==========================================================================
  // TAMPILAN 2: LAYAR STATUS & INSTRUKSI PEMBAYARAN REAL-TIME
  // ==========================================================================
  if (activeOrder) {
    const countdown = formatRemainingCountdown(activeOrder.expiresAt, nowMs);
    const steps: Array<{
      key: CustomerOrderTrackingView["status"];
      label: string;
      desc: string;
    }> = [
      {
        key: "pending",
        label: "1. Menunggu Pembayaran di Kasir",
        desc:
          activeOrder.paymentChoice === "qris"
            ? activeOrder.customerClaimedPaidAt
              ? `Kasir sedang mencocokkan pembayaran QRIS ${activeOrder.tableName} sebesar ${formatRupiah(activeOrder.total)}.`
              : "Scan/simpan QRIS di bawah lalu tekan 'Saya Sudah Bayar'."
            : `Silakan bayar tunai di Kasir dengan menyebutkan ${activeOrder.tableName}.`,
      },
      {
        key: "paid",
        label: "2. Pembayaran Sesuai — Sedang Dimasak",
        desc: "Pembayaran Anda telah diverifikasi Kasir dan pesanan sedang disiapkan Kitchen.",
      },
      {
        key: "ready",
        label: "3. Pesanan Siap Diantar",
        desc: `Pesanan sudah selesai dimasak dan sedang diantar pelayan ke ${activeOrder.tableName}.`,
      },
      {
        key: "served",
        label: "4. Sudah Diantar ke Meja",
        desc: "Selamat menikmati hidangan Anda!",
      },
    ];

    const statusOrderIndex: Record<string, number> = {
      pending: 0,
      paid: 1,
      ready: 2,
      served: 3,
    };
    const currentStepIdx = statusOrderIndex[activeOrder.status] ?? -1;

    return (
      <div className="min-h-screen bg-[#F6F8FB] px-4 py-6 text-slate-900">
        <main className="mx-auto max-w-md space-y-4">
          {/* Header Identitas Meja & Order */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <Badge className="rounded-full bg-[#00884A] text-white px-3.5 py-1 text-xs font-bold">
                  {activeOrder.tableName}
                </Badge>
                <Badge
                  variant={
                    activeOrder.status === "paid" ||
                    activeOrder.status === "ready" ||
                    activeOrder.status === "served"
                      ? "success"
                      : activeOrder.status === "pending"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {activeOrder.status.toUpperCase()}
                </Badge>
              </div>
              <CardTitle className="pt-2 text-lg font-extrabold text-slate-900">
                Nomor Order: #{activeOrder.orderNo}
              </CardTitle>
              <CardDescription className="text-slate-500">
                {activeOrder.outletName} &bull;{" "}
                {formatDateTimeWIB(activeOrder.createdAt)}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Pengumuman Jika Order EXPIRED atau CANCELLED */}
          {activeOrder.status === "expired" ? (
            <Card className="rounded-2xl border-rose-300 bg-rose-50">
              <CardHeader>
                <CardTitle className="text-base text-rose-900">
                  Waktu Pembayaran Habis (Kedaluwarsa 15 Menit)
                </CardTitle>
                <CardDescription className="text-rose-800">
                  Pesanan #{activeOrder.orderNo} otomatis dibatalkan karena
                  melewati batas waktu pembayaran 15 menit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                  onClick={handleStartNewOrder}
                >
                  Pesan Ulang Sekarang
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {activeOrder.status === "cancelled" ? (
            <Card className="rounded-2xl border-rose-300 bg-rose-50">
              <CardHeader>
                <CardTitle className="text-base text-rose-900">
                  {(activeOrder.cancelReason ?? "")
                    .toLowerCase()
                    .includes("habis")
                    ? "Mohon Maaf, Menu yang Dipesan Baru Saja Habis"
                    : "Pesanan Dibatalkan"}
                </CardTitle>
                <CardDescription className="text-rose-800 space-y-1">
                  <span className="block">
                    Informasi Kasir:{" "}
                    <strong>
                      {activeOrder.cancelReason ?? "Dibatalkan oleh Kasir"}
                    </strong>
                  </span>
                  <span className="block text-xs">
                    Silakan hubungi Kasir bila perlu bantuan lebih lanjut, atau
                    langsung buat pesanan baru di bawah ini.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                  onClick={handleStartNewOrder}
                >
                  Pilih Menu Lain / Pesan Ulang Sekarang
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Kotak Pembayaran saat Status masih PENDING */}
          {activeOrder.status === "pending" ? (
            <Card className="rounded-2xl border-2 border-[#00884A] bg-white shadow-sm">
              <CardHeader className="text-center pb-3">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-900">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Batas Waktu Bayar:</span>
                  <span className="font-mono text-sm">
                    {countdown.formatted}
                  </span>
                </div>

                <CardTitle className="pt-2 text-2xl font-extrabold text-slate-900">
                  {formatRupiah(activeOrder.total)}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Sebutkan di Kasir:{" "}
                  <strong className="text-slate-900">
                    {activeOrder.tableName} &bull; Order #{activeOrder.orderNo}
                  </strong>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {activeOrder.paymentChoice === "qris" ? (
                  <div className="space-y-4 text-center">
                    {activeOrder.qrisSvg ? (
                      <div className="mx-auto flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                        <Badge variant="outline" className="mb-1 text-[11px] font-bold">
                          QRIS PEMBAYARAN TOKO
                        </Badge>
                        <p className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                          {activeOrder.qrisMerchantName}
                        </p>
                        <div className="my-3 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {activeOrder.qrisSvg.startsWith("data:image/") ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={activeOrder.qrisSvg}
                              alt="QRIS Toko"
                              className="h-56 w-56 object-contain"
                            />
                          ) : (
                            <div
                              className="h-56 w-56"
                              dangerouslySetInnerHTML={{
                                __html: activeOrder.qrisSvg,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ) : null}

                    {activeOrder.customerClaimedPaidAt ? (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-left text-sm text-emerald-950">
                        <p className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                          Konfirmasi Pembayaran Terkirim ke Kasir
                        </p>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="lg"
                        className="h-12 w-full rounded-xl bg-[#00884A] hover:bg-[#00733E] text-white font-bold"
                        disabled={isPending}
                        onClick={handleConfirmQrisPaid}
                      >
                        {isPending
                          ? "Mengirim Konfirmasi..."
                          : "Saya Sudah Bayar QRIS"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-amber-900">
                      <Banknote className="h-4 w-4 shrink-0" />
                      <span>Instruksi Pembayaran di Kasir</span>
                    </div>
                    <p className="text-xs leading-relaxed text-amber-900">
                      Silakan menuju ke meja Kasir dalam waktu{" "}
                      <strong>{countdown.formatted}</strong> dan tunjukkan nomor
                      pesanan <strong>#{activeOrder.orderNo}</strong> untuk{" "}
                      <strong>{activeOrder.tableName}</strong> dengan total{" "}
                      <strong>{formatRupiah(activeOrder.total)}</strong>.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Pengumuman Saat Sudah SERVED */}
          {activeOrder.status === "served" ? (
            <Card className="rounded-2xl border-2 border-[#00884A] bg-emerald-50">
              <CardHeader>
                <CardTitle className="text-base text-emerald-950">
                  Pesanan Sudah Disajikan di {activeOrder.tableName}!
                </CardTitle>
                <CardDescription className="text-emerald-900">
                  Selamat menikmati hidangan Anda. Halaman pemantauan pesanan
                  ini otomatis selesai dalam{" "}
                  <strong>{servedExpireCountdown ?? 5} detik</strong>.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {/* Tahapan Progres Pesanan Real-time */}
          {activeOrder.status !== "expired" &&
          activeOrder.status !== "cancelled" ? (
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-extrabold text-slate-900">
                  Status Perjalanan Pesanan Anda
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Halaman ini memperbarui status secara otomatis setiap beberapa
                  detik.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {steps.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div
                      key={step.key}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        isCurrent
                          ? "border-[#00884A] bg-[#00884A] text-white"
                          : isDone
                            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <p className="text-sm font-bold">{step.label}</p>
                      <p
                        className={`mt-0.5 text-xs ${
                          isCurrent
                            ? "text-emerald-50"
                            : isDone
                              ? "text-emerald-800"
                              : "text-slate-400"
                        }`}
                      >
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {/* Ringkasan Item yang Dipesan (Snapshot) */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-extrabold text-slate-900">
                Rincian Pesanan
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pesanan yang sudah terkirim dikunci; jika ada revisi sebelum
                bayar, silakan hubungi Kasir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="divide-y divide-slate-100">
                {activeOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.qty}x {item.product_name}
                      </p>
                      {item.note ? (
                        <p className="text-xs text-slate-500">
                          Catatan: {item.note}
                        </p>
                      ) : null}
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatRupiah(item.line_total)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(activeOrder.subtotal)}</span>
                </div>
                {activeOrder.discount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Diskon</span>
                    <span>-{formatRupiah(activeOrder.discount)}</span>
                  </div>
                ) : null}
                {activeOrder.serviceAmount > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Service ({activeOrder.serviceRate}%)</span>
                    <span>{formatRupiah(activeOrder.serviceAmount)}</span>
                  </div>
                ) : null}
                {activeOrder.taxAmount > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Pajak ({activeOrder.taxRate}%
                      {activeOrder.priceIncludesTax ? " termasuk" : ""})
                    </span>
                    <span>{formatRupiah(activeOrder.taxAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-1.5 text-base font-extrabold text-slate-900">
                  <span>Total</span>
                  <span>{formatRupiah(activeOrder.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ==========================================================================
  // TAMPILAN 3A-0: LANDING PAGE SEBELUM PILIH MENU
  // ==========================================================================
  if (viewStep === "landing") {
    return (
      <CustomerLandingPage
        data={data}
        onEnterMenu={() => setViewStep("menu")}
      />
    );
  }

  // ==========================================================================
  // TAMPILAN 3B: HALAMAN DETAIL PESANAN & PILIHAN PEMBAYARAN
  // ==========================================================================
  if (viewStep === "detail" && cart.length > 0 && cartTotals) {
    return (
      <CustomerCheckoutDetail
        outletName={data.outlet.name}
        tableName={data.table.name}
        cart={cart}
        totals={cartTotals}
        paymentChoice={paymentChoice}
        isQrisUnderMaintenance={data.outlet.isQrisUnderMaintenance}
        isPending={isPending}
        onBackToMenu={() => setViewStep("menu")}
        onChangeQty={updateCartQty}
        onRemoveItem={removeFromCart}
        onChangeNote={updateCartNote}
        onSelectPayment={setPaymentChoice}
        onSubmitOrder={handleSubmitOrder}
      />
    );
  }

  // ==========================================================================
  // TAMPILAN 3A: JELAJAH MENU & MASUKKAN KE KERANJANG (ALA GAMBAR 2)
  // ==========================================================================
  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-40 text-slate-900">
      {/* Sticky Header Outlet, Pencarian & Kategori */}
      <header className="sticky top-0 z-20 border-b border-slate-200/75 bg-white/95 backdrop-blur-md shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="mx-auto max-w-2xl px-4 pt-3.5 pb-3 space-y-3">
          {/* Identitas Usaha & Nomor Meja */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setViewStep("landing")}
                aria-label="Kembali ke halaman sambutan"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.outlet.logoUrl}
                  alt={data.outlet.name}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 truncate">
                  {data.outlet.name}
                </h1>
                <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                  {data.outlet.address ? (
                    <>
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">{data.outlet.address}</span>
                    </>
                  ) : (
                    <span>
                      {data.outlet.description || "Pesan langsung dari meja"}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <span
              className="inline-flex h-9 items-center rounded-full px-3.5 text-xs font-extrabold text-white shadow-xs shrink-0"
              style={{ backgroundColor: data.outlet.themeColor || "#00884A" }}
            >
              {data.table.name}
            </span>
          </div>

          {/* Search Menu Bersih */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari makanan atau minuman favorit..."
              className="h-11 w-full rounded-full border border-slate-200/80 bg-slate-100/85 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00884A] focus:bg-white focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tab Kategori Tanpa Scrollbar Kasar */}
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-xs font-bold transition cursor-pointer ${
                selectedCategoryId === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Semua Menu
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-xs font-bold transition cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Daftar Menu Dikelompokkan Per Kategori */}
      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-6">
        {groupedSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-bold text-slate-700">
              Menu tidak ditemukan
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Coba kata kunci lain atau tampilkan semua kategori menu.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 h-10 rounded-full"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategoryId("ALL");
              }}
            >
              Tampilkan Semua Menu
            </Button>
          </div>
        ) : (
          groupedSections.map((section) => (
            <section
              key={section.id}
              id={`menu-section-${section.id}`}
              className="scroll-mt-48 space-y-3"
            >
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  {section.title}
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  {section.items.length} menu
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.items.map((product) => {
                  const inCart = cart.find((c) => c.product.id === product.id);
                  return (
                    <CustomerMenuItemCard
                      key={product.id}
                      product={product}
                      categoryName={
                        categoryNameMap.get(product.category_id) ?? ""
                      }
                      qtyInCart={inCart?.qty ?? 0}
                      noteInCart={inCart?.note ?? ""}
                      onAdd={addToCart}
                      onChangeQty={updateCartQty}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Drawer Daftar Kategori Cepat saat Tombol Melayang "Menu" Diklik */}
      {menuSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setMenuSheetOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-sm px-4 animate-in fade-in slide-in-from-bottom-3 duration-150">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <span className="text-sm font-extrabold text-slate-900">
                  Pilih Kategori Menu
                </span>
                <button
                  type="button"
                  onClick={() => setMenuSheetOpen(false)}
                  aria-label="Tutup daftar kategori"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                <button
                  type="button"
                  onClick={() => handleJumpToCategory("ALL")}
                  className={`flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-bold transition cursor-pointer ${
                    selectedCategoryId === "ALL"
                      ? "bg-emerald-50/70 text-[#00884A]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>Semua Menu</span>
                  <span className="text-xs text-slate-400">
                    {data.products.length}
                  </span>
                </button>
                {data.categories.map((cat) => {
                  const count = data.products.filter(
                    (p) => p.category_id === cat.id
                  ).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleJumpToCategory(cat.id)}
                      className={`flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold transition cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? "bg-emerald-50/70 text-[#00884A] font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Bottom Action Stack: Tombol "Menu" + Bar Keranjang Melayang ala Gambar 2 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2.5 px-4 pb-4">
          {/* Tombol Pill "Menu" di Tengah Atas Bar Keranjang */}
          {data.categories.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuSheetOpen((prev) => !prev)}
              className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-[#D92D4E] hover:bg-[#BE1E3D] px-4 text-xs font-extrabold text-white shadow-[0_6px_18px_rgba(217,45,78,0.35)] active:scale-95 transition cursor-pointer"
            >
              <Utensils className="h-3.5 w-3.5" />
              <span>Menu</span>
            </button>
          )}

          {/* Floating Cart Bar (Muncul Saat Ada Item di Keranjang) */}
          {cart.length > 0 && cartTotals ? (
            <div className="pointer-events-auto flex w-full items-center gap-2.5">
              <button
                type="button"
                onClick={() => setViewStep("detail")}
                className="flex min-h-14 flex-1 items-center justify-between gap-3 rounded-full bg-[#00884A] hover:bg-[#00733E] px-5 py-2.5 text-left text-white shadow-[0_10px_28px_rgba(0,136,74,0.38)] active:scale-[0.99] transition cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-sm font-extrabold leading-tight flex items-center gap-1.5">
                    <span>{totalItemsInCart} item</span>
                    <span className="text-xs font-medium text-emerald-100">
                      &bull; Lihat Detail
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-emerald-100/95">
                    {data.outlet.name} &bull; {data.table.name}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-base font-black tracking-tight tabular-nums">
                    {formatRupiah(cartTotals.total)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-emerald-100" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setViewStep("detail")}
                aria-label={`Buka keranjang (${totalItemsInCart} item)`}
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#00884A]/15 bg-white text-[#00884A] shadow-[0_8px_22px_rgba(15,23,42,0.12)] hover:bg-emerald-50 active:scale-95 transition cursor-pointer"
              >
                <ShoppingBag className="h-6 w-6" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D92D4E] px-1 text-[10px] font-extrabold text-white shadow">
                  {totalItemsInCart}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
