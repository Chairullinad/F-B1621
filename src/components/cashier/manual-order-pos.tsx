"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import {
  calculateDiscountAmount,
  calculateOrderTotals,
  formatRupiah,
} from "@/lib/money";
import type { OrderType, PaymentMethod } from "@/lib/types/database";
import {
  createManualCashierOrderAction,
  type ManualOrderWorkspaceData,
} from "@/server/manual-order-and-transactions";

interface ManualCartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  qty: number;
  note: string;
}

export function ManualOrderPos({
  initialData,
}: {
  initialData: ManualOrderWorkspaceData;
}) {
  const router = useRouter();
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<string>(
    initialData.tables[0]?.id ?? ""
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [cart, setCart] = useState<ManualCartItem[]>([]);
  const [discountType, setDiscountType] = useState<
    "none" | "amount" | "percent"
  >("none");
  const [discountValueInput, setDiscountValueInput] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    orderNo: string;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialData.products.filter((p) => {
      if (selectedCategoryId !== "all" && p.category_id !== selectedCategoryId) {
        return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [initialData.products, selectedCategoryId, searchQuery]);

  const totalsPreview = useMemo(() => {
    const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
    const rawVal = Number(discountValueInput.replace(/[^\d.]/g, "")) || 0;
    let discountAmt = 0;
    try {
      discountAmt = calculateDiscountAmount(
        subtotal,
        discountType === "none"
          ? { type: "none" }
          : { type: discountType, value: rawVal }
      );
    } catch {
      discountAmt = 0;
    }

    return calculateOrderTotals({
      items: cart.map((i) => ({ unitPrice: i.unitPrice, qty: i.qty })),
      discount:
        discountAmt > 0
          ? { type: "amount", value: discountAmt }
          : { type: "none" },
      config: initialData.outlet.taxConfig,
    });
  }, [
    cart,
    discountType,
    discountValueInput,
    initialData.outlet.taxConfig,
  ]);

  const parsedCashReceived = useMemo(() => {
    const clean = cashReceivedInput.replace(/[^\d]/g, "");
    if (!clean) return totalsPreview.total;
    return Number(clean);
  }, [cashReceivedInput, totalsPreview.total]);

  const cashShortfall =
    paymentMethod === "cash"
      ? Math.max(0, totalsPreview.total - parsedCashReceived)
      : 0;
  const cashChange =
    paymentMethod === "cash"
      ? Math.max(0, parsedCashReceived - totalsPreview.total)
      : 0;

  function handleAddToCart(product: ManualOrderWorkspaceData["products"][number]) {
    if (!product.is_available) return;
    setCompletedOrder(null);
    setErrorMsg(null);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const curr = next[idx];
        if (curr) {
          next[idx] = { ...curr, qty: curr.qty + 1 };
        }
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          qty: 1,
          note: "",
        },
      ];
    });
  }

  function handleChangeQty(index: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      const curr = next[index];
      if (!curr) return prev;
      const newQty = curr.qty + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index] = { ...curr, qty: newQty };
      }
      return next;
    });
  }

  async function handleSubmitOrder() {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const rawDiscountVal =
        Number(discountValueInput.replace(/[^\d.]/g, "")) || 0;
      const res = await createManualCashierOrderAction({
        orderType,
        tableId: orderType === "dine_in" ? selectedTableId : null,
        items: cart.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          note: i.note.trim() || null,
        })),
        discountType,
        discountValue: rawDiscountVal,
        discountReason,
        paymentMethod,
        amountReceived:
          paymentMethod === "qris" ? totalsPreview.total : parsedCashReceived,
        idempotencyKey,
      });

      if (!res.ok) {
        setErrorMsg(res.message);
        return;
      }

      setCompletedOrder({
        orderId: res.orderId ?? "",
        orderNo: res.orderNo ?? "",
        message: res.message,
      });
      setCart([]);
      setDiscountType("none");
      setDiscountValueInput("");
      setDiscountReason("");
      setCashReceivedInput("");
      setIdempotencyKey(
        `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      );
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Banner Sukses Pembuatan Order Manual */}
      {completedOrder && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
          <div>
            <p className="text-sm font-extrabold">
              ✅ {completedOrder.message}
            </p>
            <p className="text-xs text-emerald-800">
              Pesanan sudah masuk ke Layar Dapur secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {completedOrder.orderId && (
              <Link href={`/struk/${completedOrder.orderId}`}>
                <Button type="button" size="sm">
                  🖨️ Cetak Struk (#{completedOrder.orderNo})
                </Button>
              </Link>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCompletedOrder(null)}
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Kolom Kiri: Pilihan Meja/Tipe & Katalog Produk */}
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Buat Order Manual di Kasir</CardTitle>
                  <CardDescription>
                    Pilih tipe pesanan, meja, lalu klik produk untuk memasukkan
                    ke keranjang.
                  </CardDescription>
                </div>
                <Link href="/kasir">
                  <Button type="button" variant="outline" size="sm">
                    ← Kembali ke Antrean Kasir
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Pilihan Dine-in vs Takeaway */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    variant={orderType === "dine_in" ? "default" : "outline"}
                    onClick={() => setOrderType("dine_in")}
                  >
                    🍽️ Makan di Tempat
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    variant={orderType === "takeaway" ? "default" : "outline"}
                    onClick={() => setOrderType("takeaway")}
                  >
                    🥡 Takeaway / Bungkus
                  </Button>
                </div>

                {orderType === "dine_in" && (
                  <div>
                    <select
                      aria-label="Pilih Meja Pelanggan"
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold"
                    >
                      {initialData.tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Nomor {t.table_no})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Filter Kategori & Pencarian Menu */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      selectedCategoryId === "all" ? "default" : "outline"
                    }
                    onClick={() => setSelectedCategoryId("all")}
                  >
                    Semua Menu
                  </Button>
                  {initialData.categories.map((cat) => (
                    <Button
                      key={cat.id}
                      type="button"
                      size="sm"
                      variant={
                        selectedCategoryId === cat.id ? "default" : "outline"
                      }
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
                <Input
                  type="search"
                  placeholder="Cari nama menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-56"
                />
              </div>

              {/* Grid Produk */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((i) => i.productId === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={!product.is_available}
                      onClick={() => handleAddToCart(product)}
                      className={`flex min-h-24 flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                        !product.is_available
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
                          : inCart
                            ? "border-2 border-zinc-900 bg-zinc-50 shadow-sm"
                            : "border-zinc-200 bg-white hover:border-zinc-400"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-sm font-bold text-zinc-900">
                            {product.name}
                          </span>
                          {inCart && (
                            <Badge variant="default">{inCart.qty}x</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-extrabold text-zinc-800">
                          {formatRupiah(product.price)}
                        </span>
                        {!product.is_available && (
                          <Badge variant="outline">HABIS</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Keranjang, Diskon, & Pembayaran */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader className="border-b border-zinc-100 pb-3">
              <CardTitle className="text-lg">
                Rincian Order &amp; Pembayaran
              </CardTitle>
              <CardDescription>
                {orderType === "takeaway"
                  ? "Tipe: Takeaway / Bungkus"
                  : `Tipe: Makan di Tempat (${
                      initialData.tables.find((t) => t.id === selectedTableId)
                        ?.name ?? "-"
                    })`}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {cart.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500">
                  Keranjang masih kosong. Klik menu di sebelah kiri untuk
                  menambahkan pesanan.
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200">
                  {cart.map((item, idx) => (
                    <div key={item.productId} className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-zinc-900">
                            {item.productName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatRupiah(item.unitPrice)} x {item.qty} ={" "}
                            <strong>
                              {formatRupiah(item.unitPrice * item.qty)}
                            </strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleChangeQty(idx, -1)}
                          >
                            -
                          </Button>
                          <span className="w-7 text-center text-sm font-bold">
                            {item.qty}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleChangeQty(idx, 1)}
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
                          setCart((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, note: val } : row
                            )
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Pengaturan Diskon (Opsional) */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                    Diskon Order
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={discountType === "none" ? "default" : "outline"}
                      onClick={() => {
                        setDiscountType("none");
                        setDiscountValueInput("");
                      }}
                    >
                      Tanpa Diskon
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        discountType === "amount" ? "default" : "outline"
                      }
                      onClick={() => setDiscountType("amount")}
                    >
                      Rp
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        discountType === "percent" ? "default" : "outline"
                      }
                      onClick={() => setDiscountType("percent")}
                    >
                      %
                    </Button>
                  </div>
                </div>

                {discountType !== "none" && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder={
                        discountType === "amount" ? "Nominal Rp" : "Persen %"
                      }
                      value={discountValueInput}
                      onChange={(e) => setDiscountValueInput(e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder="Alasan diskon (wajib)..."
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Ringkasan Angka */}
              <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3.5 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(totalsPreview.subtotal)}</span>
                </div>
                {totalsPreview.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Diskon</span>
                    <span>- {formatRupiah(totalsPreview.discount)}</span>
                  </div>
                )}
                {totalsPreview.serviceAmount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>
                      Service Charge ({totalsPreview.serviceRate ?? 0}%)
                    </span>
                    <span>{formatRupiah(totalsPreview.serviceAmount)}</span>
                  </div>
                )}
                {totalsPreview.taxAmount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>
                      Pajak Restoran ({totalsPreview.taxRate ?? 0}%
                      {totalsPreview.priceIncludesTax ? " • Termasuk" : ""})
                    </span>
                    <span>{formatRupiah(totalsPreview.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-extrabold text-zinc-900">
                  <span>Total Bayar</span>
                  <span>{formatRupiah(totalsPreview.total)}</span>
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3.5">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    💵 Tunai
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    variant={paymentMethod === "qris" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("qris")}
                  >
                    📱 QRIS
                  </Button>
                </div>

                {paymentMethod === "cash" && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCashReceivedInput(String(totalsPreview.total))
                        }
                      >
                        Uang Pas
                      </Button>
                      {[50000, 100000, 150000, 200000].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setCashReceivedInput(String(preset))}
                        >
                          {formatRupiah(preset)}
                        </Button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-700">
                          Uang Diterima (Rp)
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={cashReceivedInput}
                          placeholder={String(totalsPreview.total)}
                          onChange={(e) => setCashReceivedInput(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                        <span className="text-[11px] text-zinc-500">
                          {cashShortfall > 0 ? "Kurang" : "Kembalian"}
                        </span>
                        <span
                          className={`text-sm font-extrabold ${
                            cashShortfall > 0
                              ? "text-red-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {cashShortfall > 0
                            ? `- ${formatRupiah(cashShortfall)}`
                            : formatRupiah(cashChange)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="button"
                disabled={
                  isSubmitting || cart.length === 0 || cashShortfall > 0
                }
                onClick={handleSubmitOrder}
                className="min-h-12 w-full bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800"
              >
                {isSubmitting
                  ? "Memproses Order..."
                  : `✅ Terima Pembayaran & Buat Order (${formatRupiah(totalsPreview.total)})`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
