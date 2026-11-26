"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Maximize2,
  Package,
  Printer,
  QrCode,
  UtensilsCrossed,
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
import {
  calculateDiscountAmount,
  calculateOrderTotals,
  formatRupiah,
} from "@/lib/money";
import { generateQrSvgString } from "@/lib/qrcode";
import { DEFAULT_FALLBACK_STATIC_QRIS } from "@/lib/qris";
import type {
  OrderItemAddonSnapshot,
  OrderType,
  PaymentMethod,
  ProductRow,
} from "@/lib/types/database";
import {
  createManualCashierOrderAction,
  type ManualOrderWorkspaceData,
} from "@/server/manual-order-and-transactions";
import { ProductAddonPickerModal } from "../shared/product-addon-picker-modal";

interface ManualCartItem {
  cartItemId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  qty: number;
  note: string;
  selectedOptionIds: string[];
  selectedAddons: OrderItemAddonSnapshot[];
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
  const [pickerProduct, setPickerProduct] = useState<ProductRow | null>(null);
  const [discountType, setDiscountType] = useState<
    "none" | "amount" | "percent"
  >("none");
  const [discountValueInput, setDiscountValueInput] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("");
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);

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
  const [paymentResultModal, setPaymentResultModal] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
    orderId?: string;
    orderNo?: string;
  } | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paymentResultModal?.status !== "success") {
      return;
    }
    redirectTimerRef.current = setTimeout(() => {
      router.push("/kasir");
    }, 1500);

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [paymentResultModal, router]);

  function cancelPendingRedirect() {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }

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

  const selectedTableObj = useMemo(
    () => initialData.tables.find((t) => t.id === selectedTableId) ?? null,
    [initialData.tables, selectedTableId]
  );

  const qrisRenderData = useMemo(() => {
    const rawPayload = initialData.outlet.qrisRawPayload?.trim() ?? "";
    const isUploadedImage = rawPayload.startsWith("data:image/");

    let svg = "";
    if (!isUploadedImage) {
      const staticSource = rawPayload.startsWith("000201")
        ? rawPayload
        : DEFAULT_FALLBACK_STATIC_QRIS;
      try {
        svg = generateQrSvgString(staticSource, 2);
      } catch {
        svg = generateQrSvgString(DEFAULT_FALLBACK_STATIC_QRIS, 2);
      }
    }

    return {
      isUploadedImage,
      uploadedImageUrl: isUploadedImage ? rawPayload : null,
      svg,
      merchantName: initialData.outlet.qrisMerchantName || initialData.outlet.name,
      label:
        orderType === "dine_in" && selectedTableObj
          ? `MEJA-${String(selectedTableObj.table_no).padStart(2, "0")} (${selectedTableObj.name})`
          : "TAKEAWAY / BUNGKUS",
    };
  }, [
    initialData.outlet.qrisRawPayload,
    initialData.outlet.qrisMerchantName,
    initialData.outlet.name,
    orderType,
    selectedTableObj,
  ]);

  function addConfiguredItem(params: {
    product: ProductRow;
    selectedOptionIds: string[];
    selectedAddons: OrderItemAddonSnapshot[];
    unitPrice: number;
    qty: number;
    note: string;
  }) {
    const canonicalAddonKey = [...params.selectedOptionIds].sort().join(",");
    const cleanNote = params.note.trim();
    const cartItemId = `${params.product.id}::${canonicalAddonKey}::${cleanNote}`;

    setCompletedOrder(null);
    setErrorMsg(null);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (idx >= 0) {
        const next = [...prev];
        const curr = next[idx];
        if (curr) {
          next[idx] = { ...curr, qty: Math.min(100, curr.qty + params.qty) };
        }
        return next;
      }
      return [
        ...prev,
        {
          cartItemId,
          productId: params.product.id,
          productName: params.product.name,
          unitPrice: params.unitPrice,
          qty: Math.min(100, params.qty),
          note: cleanNote,
          selectedOptionIds: [...params.selectedOptionIds].sort(),
          selectedAddons: params.selectedAddons,
        },
      ];
    });
  }

  function handleAddToCart(product: ManualOrderWorkspaceData["products"][number]) {
    if (!product.is_available) return;
    const assignedAddons = initialData.addonsByProduct[product.id] ?? [];
    if (assignedAddons.length > 0) {
      setPickerProduct(product);
      return;
    }
    addConfiguredItem({
      product,
      selectedOptionIds: [],
      selectedAddons: [],
      unitPrice: product.price,
      qty: 1,
      note: "",
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
          addonOptionIds: i.selectedOptionIds,
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
        setPaymentResultModal({
          status: "error",
          title: "Pembayaran Gagal",
          message: res.message,
        });
        return;
      }

      setCompletedOrder({
        orderId: res.orderId ?? "",
        orderNo: res.orderNo ?? "",
        message: res.message,
      });
      setPaymentResultModal({
        status: "success",
        title: "Pembayaran Berhasil",
        message: res.message,
        orderId: res.orderId ?? "",
        orderNo: res.orderNo ?? "",
      });
      setShowQrisModal(false);
      setCart([]);
      setDiscountType("none");
      setDiscountValueInput("");
      setDiscountReason("");
      setCashReceivedInput("");
      setIdempotencyKey(
        `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      );
      router.refresh();
    } catch (err) {
      const fallbackMessage =
        err instanceof Error && err.message
          ? err.message
          : "Terjadi kesalahan jaringan saat memproses pembayaran.";
      setErrorMsg(fallbackMessage);
      setPaymentResultModal({
        status: "error",
        title: "Pembayaran Gagal",
        message: fallbackMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Banner Sukses Pembuatan Order Manual */}
      {completedOrder && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-emerald-500 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-950 dark:text-emerald-200 shadow-sm">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-extrabold">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              {completedOrder.message}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              Pesanan sudah masuk ke Layar Dapur secara real-time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {completedOrder.orderId && (
              <>
                <Link href={`/struk/${completedOrder.orderId}?autoprint=1`}>
                  <Button type="button" size="sm">
                    <Printer className="mr-1.5 h-4 w-4" />
                    Cetak Struk (#{completedOrder.orderNo})
                  </Button>
                </Link>
                <Link href={`/struk/${completedOrder.orderId}`}>
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
              onClick={() => setCompletedOrder(null)}
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-900 dark:text-red-200">
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
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Kembali ke Antrean Kasir
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
                    <UtensilsCrossed className="mr-1.5 h-4 w-4" />
                    Makan di Tempat
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    variant={orderType === "takeaway" ? "default" : "outline"}
                    onClick={() => setOrderType("takeaway")}
                  >
                    <Package className="mr-1.5 h-4 w-4" />
                    Takeaway / Bungkus
                  </Button>
                </div>

                {orderType === "dine_in" && (
                  <div>
                    <select
                      aria-label="Pilih Meja Pelanggan"
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="h-11 w-full rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-zinc-900 dark:text-slate-100"
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-slate-800 pt-3">
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
                  const totalQtyInCart = cart
                    .filter((i) => i.productId === product.id)
                    .reduce((sum, i) => sum + i.qty, 0);
                  const hasAddons =
                    (initialData.addonsByProduct[product.id]?.length ?? 0) > 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={!product.is_available}
                      onClick={() => handleAddToCart(product)}
                      className={`flex min-h-24 flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                        !product.is_available
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60 dark:border-slate-800 dark:bg-slate-800/50"
                          : totalQtyInCart > 0
                            ? "border-2 border-blue-600 bg-blue-50/50 shadow-xs dark:border-sky-500 dark:bg-sky-950/40"
                            : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {product.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white object-cover shadow-2xs"
                          />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-2xs">
                            <UtensilsCrossed className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
                              {product.name}
                            </span>
                            {totalQtyInCart > 0 && (
                              <Badge variant="default" className="shrink-0 text-2xs">
                                {totalQtyInCart}x
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-blue-700 dark:text-sky-400">
                          {formatRupiah(product.price)}
                        </span>
                        {!product.is_available ? (
                          <Badge variant="outline" className="text-2xs">
                            HABIS
                          </Badge>
                        ) : hasAddons ? (
                          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-sky-950/60 dark:text-sky-300">
                            + Add-on
                          </span>
                        ) : null}
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
            <CardHeader className="border-b border-zinc-100 dark:border-slate-800 pb-3">
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
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-slate-700 py-10 text-center text-sm text-zinc-500 dark:text-slate-400">
                  Keranjang masih kosong. Klik menu di sebelah kiri untuk
                  menambahkan pesanan.
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-slate-800 rounded-xl border border-zinc-200 dark:border-slate-800">
                  {cart.map((item, idx) => (
                    <div key={item.cartItemId} className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-slate-100">
                            {item.productName}
                          </p>
                          {item.selectedAddons.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.selectedAddons.map((addon) => (
                                <span
                                  key={addon.optionId}
                                  className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-sky-950/50 dark:text-sky-300"
                                >
                                  {addon.optionName}
                                  {addon.priceDelta > 0
                                    ? ` (+${formatRupiah(addon.priceDelta)})`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-slate-400">
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
              <div className="rounded-xl border border-zinc-200 dark:border-slate-800 bg-zinc-50/60 dark:bg-slate-800/50 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-slate-300">
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
              <div className="space-y-1.5 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-sm">
                <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatRupiah(totalsPreview.subtotal)}</span>
                </div>
                {totalsPreview.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Diskon</span>
                    <span>- {formatRupiah(totalsPreview.discount)}</span>
                  </div>
                )}
                {totalsPreview.serviceAmount > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                    <span>
                      Service Charge ({totalsPreview.serviceRate ?? 0}%)
                    </span>
                    <span>{formatRupiah(totalsPreview.serviceAmount)}</span>
                  </div>
                )}
                {totalsPreview.taxAmount > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-slate-400">
                    <span>
                      Pajak Restoran ({totalsPreview.taxRate ?? 0}%
                      {totalsPreview.priceIncludesTax ? " • Termasuk" : ""})
                    </span>
                    <span>{formatRupiah(totalsPreview.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 dark:border-slate-800 pt-2 text-base font-extrabold text-zinc-900 dark:text-slate-100">
                  <span>Total Bayar</span>
                  <span>{formatRupiah(totalsPreview.total)}</span>
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="min-h-[44px] flex-1"
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <Banknote className="mr-1.5 h-4 w-4" />
                    Tunai
                  </Button>
                  <Button
                    type="button"
                    className="min-h-[44px] flex-1"
                    variant={paymentMethod === "qris" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("qris")}
                  >
                    <QrCode className="mr-1.5 h-4 w-4" />
                    QRIS Manual
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
                        <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-slate-300">
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
                      <div className="flex flex-col justify-center rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/70 px-3 py-1.5">
                        <span className="text-[11px] text-zinc-500 dark:text-slate-400">
                          {cashShortfall > 0 ? "Kurang" : "Kembalian"}
                        </span>
                        <span
                          className={`text-sm font-extrabold ${
                            cashShortfall > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-700 dark:text-emerald-400"
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

                {paymentMethod === "qris" && (
                  <div className="space-y-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/30 p-3 text-center">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        QRIS Manual &bull; {qrisRenderData.merchantName}
                      </p>
                      <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                        Nominal tercatat ke laporan &amp; kas QRIS sebesar{" "}
                        {formatRupiah(totalsPreview.total)}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Cocok untuk pembayaran via QRIS standee meja kasir atau EDC QRIS sebelum integrasi gateway otomatis aktif.
                      </p>
                    </div>

                    <div className="mx-auto flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
                      {qrisRenderData.isUploadedImage &&
                      qrisRenderData.uploadedImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={qrisRenderData.uploadedImageUrl}
                          alt="QRIS Toko"
                          className="h-44 w-44 object-contain"
                        />
                      ) : (
                        <div
                          className="h-44 w-44"
                          dangerouslySetInnerHTML={{
                            __html: qrisRenderData.svg,
                          }}
                        />
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQrisModal(true)}
                      className="w-full border-sky-300 bg-white font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-950/60"
                    >
                      <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                      Tampilkan Popup QRIS Layar Penuh
                    </Button>
                  </div>
                )}
              </div>

              {paymentMethod === "qris" ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    disabled={isSubmitting || cart.length === 0}
                    onClick={handleSubmitOrder}
                    className="min-h-12 w-full bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {isSubmitting
                      ? "Memproses Order..."
                      : `Simpan Bayar QRIS Manual & Buat Order (${formatRupiah(totalsPreview.total)})`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting || cart.length === 0}
                    onClick={() => setShowQrisModal(true)}
                    className="min-h-11 w-full border-sky-300 text-sm font-semibold text-sky-900 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/60"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Tampilkan Popup QRIS untuk Pelanggan
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  disabled={
                    isSubmitting || cart.length === 0 || cashShortfall > 0
                  }
                  onClick={handleSubmitOrder}
                  className="min-h-12 w-full bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {isSubmitting
                    ? "Memproses Order..."
                    : `Terima Pembayaran & Buat Order (${formatRupiah(totalsPreview.total)})`}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* POPUP MODAL QRIS KASIR (ORDER MANUAL) */}
      {showQrisModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isSubmitting) setShowQrisModal(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <Badge className="mb-1 bg-[#1E88E5] text-white">
                  PEMBAYARAN QRIS KASIR
                </Badge>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {qrisRenderData.merchantName}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {qrisRenderData.label}
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowQrisModal(false)}
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
                  {formatRupiah(totalsPreview.total)}
                </p>
              </div>

              <div className="mx-auto flex w-fit flex-col items-center justify-center rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-sm">
                {qrisRenderData.isUploadedImage &&
                qrisRenderData.uploadedImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrisRenderData.uploadedImageUrl}
                    alt="QRIS Toko"
                    className="h-64 w-64 object-contain"
                  />
                ) : (
                  <div
                    className="h-64 w-64"
                    dangerouslySetInnerHTML={{
                      __html: qrisRenderData.svg,
                    }}
                  />
                )}
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 text-center text-xs text-emerald-950 dark:text-emerald-200">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  Ketik / Pastikan Nominal Tagihan: {formatRupiah(totalsPreview.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                  Arahkan pelanggan scan QRIS di atas dengan m-Banking / e-Wallet (BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, Dana, dll) dan ketik nominal tagihan di atas.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs font-medium text-red-900 dark:text-red-200">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setShowQrisModal(false)}
                className="min-h-11 sm:w-1/3"
              >
                Kembali
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || cart.length === 0}
                onClick={handleSubmitOrder}
                className="min-h-11 flex-1 bg-emerald-700 font-bold text-white hover:bg-emerald-800"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {isSubmitting
                  ? "Memproses..."
                  : "Pembayaran QRIS Sesuai — Selesaikan Order"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP HASIL PEMBAYARAN MANUAL (BERHASIL / GAGAL) */}
      {paymentResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => {
            if (paymentResultModal.status === "error") {
              setPaymentResultModal(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-payment-result-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              {paymentResultModal.status === "success" ? (
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              ) : (
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                  <AlertCircle className="h-8 w-8" />
                </div>
              )}

              <h3
                id="manual-payment-result-title"
                className="text-xl font-extrabold text-slate-900 dark:text-slate-100"
              >
                {paymentResultModal.title}
              </h3>

              {paymentResultModal.status === "success" &&
                paymentResultModal.orderNo && (
                  <Badge className="mt-2 bg-emerald-700 text-white">
                    Order #{paymentResultModal.orderNo}
                  </Badge>
                )}

              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300">
                {paymentResultModal.message}
              </p>

              {paymentResultModal.status === "success" && (
                <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Otomatis dialihkan ke menu Pesanan Layar Kasir...
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {paymentResultModal.status === "success" ? (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      cancelPendingRedirect();
                      router.push("/kasir");
                    }}
                    className="min-h-11 w-full bg-emerald-700 font-bold text-white hover:bg-emerald-800"
                  >
                    Ke Menu Pesanan Layar Kasir Sekarang
                  </Button>
                  {paymentResultModal.orderId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        cancelPendingRedirect();
                        router.push(
                          `/struk/${paymentResultModal.orderId}?autoprint=1`
                        );
                      }}
                      className="min-h-11 w-full font-semibold"
                    >
                      <Printer className="mr-1.5 h-4 w-4" />
                      Cetak Struk (#{paymentResultModal.orderNo})
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => setPaymentResultModal(null)}
                  className="min-h-11 w-full bg-rose-600 font-bold text-white hover:bg-rose-700"
                >
                  Tutup & Perbaiki Pesanan
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <ProductAddonPickerModal
        product={pickerProduct}
        groups={
          pickerProduct
            ? (initialData.addonsByProduct[pickerProduct.id] ?? [])
            : []
        }
        onClose={() => setPickerProduct(null)}
        onConfirm={(payload) => {
          addConfiguredItem(payload);
          setPickerProduct(null);
        }}
      />
    </div>
  );
}
