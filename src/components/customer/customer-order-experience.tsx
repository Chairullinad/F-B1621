"use client";

import * as React from "react";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
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

interface CartItem {
  product: ProductRow;
  qty: number;
  note: string;
}

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

export function CustomerOrderExperience({
  data,
}: {
  data: CustomerTablePublicData;
}) {
  const storageKey = `pos1621_active_order_${data.table.qrToken}`;

  const [selectedCategoryId, setSelectedCategoryId] =
    React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [paymentChoice, setPaymentChoice] =
    React.useState<PaymentMethod>("qris");
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>(() =>
    generateClientIdempotencyKey(data.table.tableNo)
  );

  const [activeOrder, setActiveOrder] =
    React.useState<CustomerOrderTrackingView | null>(null);
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

  // Timer 1 detik untuk hitung mundur 15 menit
  React.useEffect(() => {
    if (!activeOrder || activeOrder.status !== "pending") return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
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

  // Begitu status mencapai SERVED, hitung mundur 8 detik lalu kunci/akhiri sesi halaman order otomatis
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

  const filteredProducts = React.useMemo(() => {
    return data.products.filter((p) => {
      if (selectedCategoryId !== "ALL" && p.category_id !== selectedCategoryId) {
        return false;
      }
      if (
        searchQuery.trim().length > 0 &&
        !p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data.products, selectedCategoryId, searchQuery]);

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
        i === idx
          ? { ...item, qty: Math.min(50, item.qty + 1) }
          : item
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

  function updateCartNote(productId: string, note: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, note } : item
      )
    );
  }

  function handleSubmitOrder() {
    if (cart.length === 0) {
      toast.error("Pilih minimal 1 menu terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const res = await createCustomerOrderAction({
        qrToken: data.table.qrToken,
        paymentChoice,
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
    setServedExpireCountdown(null);
    setIdempotencyKey(generateClientIdempotencyKey(data.table.tableNo));
  }

  // ==========================================================================
  // TAMPILAN 1: SESI PEMANTAUAN SUDAH BERAKHIR (SETELAH DISAJIKAN / SERVED)
  // ==========================================================================
  if (activeOrder && activeOrder.sessionExpired) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <Card className="border-2 border-zinc-900">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold text-white">
              ✓
            </div>
            <CardTitle className="text-xl">
              Sesi Pesanan #{activeOrder.orderNo} Telah Selesai
            </CardTitle>
            <CardDescription>
              Pesanan Anda di <strong>{activeOrder.tableName}</strong> sudah
              selesai disajikan dan halaman pemantauan pesanan ini telah
              berakhir (<em>expired</em>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              className="w-full"
              size="lg"
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
  // TAMPILAN 2: LAYAR PEMBAYARAN QRIS / TUNAI & TRACKING STATUS REAL-TIME
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
        label: "1. Menunggu Pembayaran / Verifikasi Kasir",
        desc:
          activeOrder.paymentChoice === "qris"
            ? activeOrder.customerClaimedPaidAt
              ? `Kasir sedang mencocokkan pembayaran QRIS ${activeOrder.tableName} sebesar ${formatRupiah(activeOrder.total)}.`
              : "Scan/simpan QRIS di bawah lalu tekan 'Saya Sudah Bayar'."
            : `Silakan bayar tunai di Kasir dengan menyebutkan ${activeOrder.tableName}.`,
      },
      {
        key: "paid",
        label: "2. Pembayaran Sesuai — Sedang Disiapkan Kitchen",
        desc: "Pembayaran Anda telah diverifikasi Kasir dan pesanan sedang dimasak di Kitchen.",
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
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {/* Header Identitas Meja & Order */}
        <Card className="border-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="default" className="text-sm px-3 py-1">
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
            <CardTitle className="pt-2 text-lg">
              Nomor Order: #{activeOrder.orderNo}
            </CardTitle>
            <CardDescription>
              {activeOrder.outletName} &bull;{" "}
              {formatDateTimeWIB(activeOrder.createdAt)}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pengumuman Jika Order EXPIRED atau CANCELLED */}
        {activeOrder.status === "expired" ? (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-base text-red-900">
                Waktu Pembayaran Habis (Kedaluwarsa 15 Menit)
              </CardTitle>
              <CardDescription className="text-red-800">
                Pesanan #{activeOrder.orderNo} otomatis dibatalkan karena
                melewati batas waktu pembayaran 15 menit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleStartNewOrder}
              >
                Pesan Ulang Sekarang
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {activeOrder.status === "cancelled" ? (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-base text-red-900">
                {(activeOrder.cancelReason ?? "").toLowerCase().includes("habis")
                  ? "Mohon Maaf, Menu yang Dipesan Baru Saja Habis"
                  : "Pesanan Dibatalkan"}
              </CardTitle>
              <CardDescription className="text-red-800 space-y-1">
                <span className="block">
                  Informasi Kasir:{" "}
                  <strong>
                    {activeOrder.cancelReason ?? "Dibatalkan oleh Kasir"}
                  </strong>
                </span>
                <span className="block text-xs">
                  Jika Anda sudah melakukan pembayaran QRIS, silakan hubungi
                  Kasir untuk pengembalian uang tunai atau tukar pesanan
                  (Rebilling). Anda juga dapat langsung memesan menu lain di
                  bawah ini.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleStartNewOrder}
              >
                Pilih Menu Lain / Pesan Ulang Sekarang
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Kotak Pembayaran saat Status masih PENDING */}
        {activeOrder.status === "pending" ? (
          <Card className="border-2 border-zinc-900">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-900">
                <span>Batas Waktu Pembayaran:</span>
                <span className="font-mono text-sm">{countdown.formatted}</span>
              </div>

              <CardTitle className="pt-2 text-xl">
                Total Tagihan: {formatRupiah(activeOrder.total)}
              </CardTitle>
              <CardDescription>
                Penanda Kasir:{" "}
                <strong className="text-zinc-900">
                  {activeOrder.tableName} &bull;{" "}
                  {formatRupiah(activeOrder.total)}
                </strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {activeOrder.paymentChoice === "qris" ? (
                <div className="space-y-4 text-center">
                  {activeOrder.qrisSvg ? (
                    <div className="mx-auto flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                        QRIS {activeOrder.qrisMerchantName}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Label: MEJA-
                        {String(activeOrder.tableNo).padStart(2, "0")} &bull;{" "}
                        {formatRupiah(activeOrder.total)}
                      </p>
                      <div
                        className="my-2 h-56 w-56"
                        dangerouslySetInnerHTML={{
                          __html: activeOrder.qrisSvg,
                        }}
                      />
                      <p className="text-xs text-zinc-600">
                        Scan atau screenshot QRIS di atas menggunakan aplikasi
                        m-Banking / e-Wallet Anda. Nominal sudah terisi otomatis.
                      </p>
                    </div>
                  ) : null}

                  {activeOrder.customerClaimedPaidAt ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-left text-sm text-emerald-950">
                      <p className="font-bold">
                        ✓ Konfirmasi Pembayaran Terkirim ke Kasir
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        Notifikasi{" "}
                        <strong>
                          {activeOrder.tableName} —{" "}
                          {formatRupiah(activeOrder.total)}
                        </strong>{" "}
                        sudah tampil di Layar Kasir. Begitu Kasir menekan{" "}
                        <em>Pembayaran Sesuai</em>, halaman ini otomatis berubah
                        dan pesanan masuk ke Dapur.
                      </p>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                      disabled={isPending}
                      onClick={handleConfirmQrisPaid}
                    >
                      {isPending
                        ? "Mengirim Konfirmasi ke Kasir..."
                        : "Saya Sudah Bayar QRIS"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-bold">Instruksi Bayar Tunai di Kasir:</p>
                  <p className="mt-1">
                    Silakan menuju ke Kasir dalam waktu{" "}
                    <strong>{countdown.formatted}</strong> dan sebutkan{" "}
                    <strong>{activeOrder.tableName}</strong> (Order #
                    {activeOrder.orderNo}) dengan total{" "}
                    <strong>{formatRupiah(activeOrder.total)}</strong>.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Pengumuman Saat Sudah SERVED */}
        {activeOrder.status === "served" ? (
          <Card className="border-2 border-emerald-600 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-base text-emerald-950">
                Pesanan Sudah Disajikan di {activeOrder.tableName}!
              </CardTitle>
              <CardDescription className="text-emerald-900">
                Selamat menikmati hidangan Anda. Halaman pemantauan pesanan ini
                akan otomatis ditutup dalam{" "}
                <strong>{servedExpireCountdown ?? 5} detik</strong>.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {/* Tahapan Progres Pesanan Real-time */}
        {activeOrder.status !== "expired" &&
        activeOrder.status !== "cancelled" ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Status Perjalanan Pesanan Anda
              </CardTitle>
              <CardDescription>
                Halaman ini memperbarui status secara otomatis setiap beberapa
                detik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.map((step, idx) => {
                const isDone = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div
                    key={step.key}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isCurrent
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                          : "border-zinc-200 bg-zinc-50 text-zinc-400"
                    }`}
                  >
                    <p className="text-sm font-bold">{step.label}</p>
                    <p
                      className={`mt-0.5 text-xs ${
                        isCurrent
                          ? "text-zinc-200"
                          : isDone
                            ? "text-emerald-800"
                            : "text-zinc-400"
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rincian Pesanan</CardTitle>
            <CardDescription>
              Pesanan yang sudah terkirim tidak dapat diedit dari HP; jika ada
              perubahan sebelum bayar, silakan minta bantuan Kasir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="divide-y divide-zinc-200">
              {activeOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {item.qty}x {item.product_name}
                    </p>
                    {item.note ? (
                      <p className="text-xs text-zinc-500">
                        Catatan: {item.note}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-semibold">
                    {formatRupiah(item.line_total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-zinc-600">
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
                <div className="flex justify-between text-zinc-600">
                  <span>Service ({activeOrder.serviceRate}%)</span>
                  <span>{formatRupiah(activeOrder.serviceAmount)}</span>
                </div>
              ) : null}
              {activeOrder.taxAmount > 0 ? (
                <div className="flex justify-between text-zinc-600">
                  <span>
                    Pajak ({activeOrder.taxRate}%
                    {activeOrder.priceIncludesTax ? " termasuk" : ""})
                  </span>
                  <span>{formatRupiah(activeOrder.taxAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 text-base font-bold text-zinc-950">
                <span>Total</span>
                <span>{formatRupiah(activeOrder.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ==========================================================================
  // TAMPILAN 3: PEMILIHAN MENU & KERANJANG BELANJA PELANGGAN
  // ==========================================================================
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      {/* Header Outlet & Nomor Meja Tetap */}
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <Image
              src="/logo-1621.png"
              alt="Logo f&b1621"
              width={48}
              height={48}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 truncate">
              {data.outlet.name}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              1621F&amp;B &bull; QRIS Meja / Tunai di Kasir
            </p>
          </div>
        </div>
        <Badge className="bg-[#3B7097] text-white px-3.5 py-1.5 text-sm font-bold shadow-xs shrink-0">
          {data.table.name}
        </Badge>
      </div>

      {/* Pencarian & Tab Kategori */}
      <div className="mb-5 space-y-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari makanan atau minuman..."
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            type="button"
            variant={selectedCategoryId === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategoryId("ALL")}
          >
            Semua Menu
          </Button>
          {data.categories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={selectedCategoryId === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Daftar Produk */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredProducts.map((product) => {
          const inCart = cart.find((c) => c.product.id === product.id);
          const isOut = !product.is_available;

          return (
            <Card
              key={product.id}
              className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                isOut
                  ? "border-zinc-200 bg-zinc-100 opacity-60"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3 p-3.5 pb-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl shadow-2xs">
                  {product.emoji || "🍽️"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <CardTitle className="text-sm font-bold leading-tight text-slate-900">
                      {product.name}
                    </CardTitle>
                    {isOut ? (
                      <Badge variant="destructive" className="shrink-0 text-2xs">
                        Habis
                      </Badge>
                    ) : inCart ? (
                      <Badge variant="success" className="shrink-0 text-2xs">
                        {inCart.qty}x
                      </Badge>
                    ) : null}
                  </div>
                  <p className="pt-1 text-sm font-bold text-blue-600">
                    {formatRupiah(product.price)}
                  </p>
                </div>
              </div>

              <CardContent className="p-3.5 pt-3">
                {isOut ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled
                  >
                    Stok Habis
                  </Button>
                ) : inCart ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Kurangi ${product.name}`}
                      onClick={() => updateCartQty(product.id, -1)}
                    >
                      -
                    </Button>
                    <span className="text-base font-bold">{inCart.qty}</span>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      aria-label={`Tambah ${product.name}`}
                      onClick={() => updateCartQty(product.id, 1)}
                    >
                      +
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => addToCart(product)}
                  >
                    + Tambah ke Pesanan
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Keranjang & Pilihan Metode Pembayaran */}
      {cart.length > 0 && cartTotals ? (
        <Card className="mt-6 border-2 border-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg">
              Keranjang Pesanan — {data.table.name} ({totalItemsInCart} Item)
            </CardTitle>
            <CardDescription>
              Periksa kembali menu dan catatan Anda sebelum mengirim pesanan.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="divide-y divide-zinc-200">
              {cart.map((item) => (
                <div key={item.product.id} className="space-y-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="text-xs text-zinc-600">
                        {formatRupiah(item.product.price)} x {item.qty} ={" "}
                        <strong>
                          {formatRupiah(item.product.price * item.qty)}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateCartQty(item.product.id, -1)}
                      >
                        -
                      </Button>
                      <span className="w-6 text-center font-bold">
                        {item.qty}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateCartQty(item.product.id, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={item.note}
                    onChange={(e) =>
                      updateCartNote(item.product.id, e.target.value)
                    }
                    placeholder="Catatan untuk dapur (opsional, misal: tidak pedas)..."
                    className="text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Pilihan Metode Pembayaran */}
            <div className="space-y-2 pt-2">
              <p className="text-sm font-semibold">Pilih Metode Pembayaran:</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentChoice("qris")}
                  className={`flex min-h-12 flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                    paymentChoice === "qris"
                      ? "border-2 border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  <span className="text-sm font-bold">
                    QRIS di Meja (Utama)
                  </span>
                  <span
                    className={`text-xs ${
                      paymentChoice === "qris"
                        ? "text-zinc-200"
                        : "text-zinc-500"
                    }`}
                  >
                    QRIS langsung tampil, bayar dari meja Anda
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentChoice("cash")}
                  className={`flex min-h-12 flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                    paymentChoice === "cash"
                      ? "border-2 border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  <span className="text-sm font-bold">
                    Bayar Tunai di Kasir
                  </span>
                  <span
                    className={`text-xs ${
                      paymentChoice === "cash"
                        ? "text-zinc-200"
                        : "text-zinc-500"
                    }`}
                  >
                    Bayar uang tunai di meja Kasir dalam 15 menit
                  </span>
                </button>
              </div>
            </div>

            {/* Ringkasan Harga */}
            <div className="rounded-xl bg-zinc-50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span>{formatRupiah(cartTotals.subtotal)}</span>
              </div>
              {cartTotals.serviceAmount > 0 ? (
                <div className="flex justify-between text-zinc-600">
                  <span>Service Charge ({cartTotals.serviceRate}%)</span>
                  <span>{formatRupiah(cartTotals.serviceAmount)}</span>
                </div>
              ) : null}
              {cartTotals.taxAmount > 0 ? (
                <div className="flex justify-between text-zinc-600">
                  <span>
                    Pajak ({cartTotals.taxRate}%
                    {cartTotals.priceIncludesTax ? " termasuk" : ""})
                  </span>
                  <span>{formatRupiah(cartTotals.taxAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-950">
                <span>Total Bayar</span>
                <span>{formatRupiah(cartTotals.total)}</span>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full font-bold"
              disabled={isPending}
              onClick={handleSubmitOrder}
            >
              {isPending
                ? "Mengirim Pesanan..."
                : `Kirim Pesanan (${formatRupiah(cartTotals.total)})`}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
