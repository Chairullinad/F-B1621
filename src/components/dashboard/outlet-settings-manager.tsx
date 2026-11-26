"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Upload, QrCode, CheckCircle2, Sparkles } from "lucide-react";
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
import { formatRupiah } from "@/lib/money";
import { generateQrSvgString } from "@/lib/qrcode";
import {
  extractMerchantInfoFromQris,
  generateDynamicQrisPayload,
} from "@/lib/qris";
import type { OutletRow } from "@/lib/types/database";
import {
  updateOutletProfileSettingsAction,
  updateQrisSettingsAction,
  updateTaxAndServiceSettingsAction,
} from "@/server/master-data";

function parsePercentValue(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function OutletSettingsManager({
  initialOutlet,
}: {
  initialOutlet: OutletRow;
}) {
  const router = useRouter();

  // 1. State Profil Outlet, WiFi Struk & Batas Diskon Kasir
  const [name, setName] = React.useState(initialOutlet.name);
  const [address, setAddress] = React.useState(initialOutlet.address ?? "");
  const [receiptFooter, setReceiptFooter] = React.useState(
    initialOutlet.receipt_footer ?? ""
  );
  const [wifiName, setWifiName] = React.useState(initialOutlet.wifi_name ?? "");
  const [wifiPassword, setWifiPassword] = React.useState(
    initialOutlet.wifi_password ?? ""
  );
  const [expiryMinutes, setExpiryMinutes] = React.useState(
    String(initialOutlet.order_expiry_minutes)
  );
  const [maxDiscountPercent, setMaxDiscountPercent] = React.useState(
    initialOutlet.max_cashier_discount_percent !== null
      ? String(initialOutlet.max_cashier_discount_percent)
      : ""
  );
  const [maxDiscountAmount, setMaxDiscountAmount] = React.useState(
    initialOutlet.max_cashier_discount_amount !== null
      ? String(initialOutlet.max_cashier_discount_amount)
      : ""
  );

  // 2. State Pajak & Service Charge
  const [taxPercentStr, setTaxPercentStr] = React.useState(
    initialOutlet.tax_percent !== null ? String(initialOutlet.tax_percent) : ""
  );
  const [taxEnabled, setTaxEnabled] = React.useState(initialOutlet.tax_enabled);
  const [servicePercentStr, setServicePercentStr] = React.useState(
    initialOutlet.service_percent !== null
      ? String(initialOutlet.service_percent)
      : ""
  );
  const [serviceEnabled, setServiceEnabled] = React.useState(
    initialOutlet.service_enabled
  );
  const [priceIncludesTax, setPriceIncludesTax] = React.useState(
    initialOutlet.price_includes_tax
  );

  // 3. State Pengaturan QRIS Toko
  const [qrisMerchantName, setQrisMerchantName] = React.useState(() => {
    const initialMerchant = (initialOutlet.qris_merchant_name ?? "").trim();
    if (
      !initialMerchant ||
      initialMerchant.toLowerCase().includes("nusantara")
    ) {
      return initialOutlet.name.toLowerCase().includes("nusantara")
        ? "1621 GROUP"
        : initialOutlet.name;
    }
    return initialMerchant;
  });
  const [qrisRawPayload, setQrisRawPayload] = React.useState(
    initialOutlet.qris_raw_payload ?? ""
  );
  const [qrisEnabled, setQrisEnabled] = React.useState(
    initialOutlet.qris_enabled
  );
  const [qrisImagePreview, setQrisImagePreview] = React.useState<string | null>(
    initialOutlet.qris_raw_payload?.startsWith("data:image/")
      ? initialOutlet.qris_raw_payload
      : null
  );
  const [isScanningQrisImage, setIsScanningQrisImage] = React.useState(false);

  const [isPending, startTransition] = React.useTransition();
  const taxPercentInputRef = React.useRef<HTMLInputElement | null>(null);
  const servicePercentInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sinkronkan ulang state saat berpindah outlet atau setelah router.refresh()
  React.useEffect(() => {
    setName(initialOutlet.name);
    setAddress(initialOutlet.address ?? "");
    setReceiptFooter(initialOutlet.receipt_footer ?? "");
    setWifiName(initialOutlet.wifi_name ?? "");
    setWifiPassword(initialOutlet.wifi_password ?? "");
    setExpiryMinutes(String(initialOutlet.order_expiry_minutes));
    setMaxDiscountPercent(
      initialOutlet.max_cashier_discount_percent !== null
        ? String(initialOutlet.max_cashier_discount_percent)
        : ""
    );
    setMaxDiscountAmount(
      initialOutlet.max_cashier_discount_amount !== null
        ? String(initialOutlet.max_cashier_discount_amount)
        : ""
    );
    setTaxPercentStr(
      initialOutlet.tax_percent !== null ? String(initialOutlet.tax_percent) : ""
    );
    setTaxEnabled(initialOutlet.tax_enabled);
    setServicePercentStr(
      initialOutlet.service_percent !== null
        ? String(initialOutlet.service_percent)
        : ""
    );
    setServiceEnabled(initialOutlet.service_enabled);
    setPriceIncludesTax(initialOutlet.price_includes_tax);
    setQrisRawPayload(initialOutlet.qris_raw_payload ?? "");
    setQrisEnabled(initialOutlet.qris_enabled);
    setQrisImagePreview(
      initialOutlet.qris_raw_payload?.startsWith("data:image/")
        ? initialOutlet.qris_raw_payload
        : null
    );
  }, [initialOutlet]);

  const parsedTaxPercent = parsePercentValue(taxPercentStr);
  const canEnableTax =
    parsedTaxPercent !== null && parsedTaxPercent > 0 && parsedTaxPercent <= 100;

  const parsedServicePercent = parsePercentValue(servicePercentStr);
  const canEnableService =
    parsedServicePercent !== null &&
    parsedServicePercent > 0 &&
    parsedServicePercent <= 100;

  const trimmedQrisPayload = qrisRawPayload.trim();
  const isUploadedQrisImage = trimmedQrisPayload.startsWith("data:image/");
  const isEmvQrisPayload = trimmedQrisPayload.startsWith("000201");
  const canEnableQris = isEmvQrisPayload || isUploadedQrisImage;

  function handleSaveOutletProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const exp = Number.parseInt(expiryMinutes, 10);
    const maxPct = parsePercentValue(maxDiscountPercent);
    const maxAmt =
      maxDiscountAmount.trim().length > 0
        ? Number.parseInt(maxDiscountAmount, 10)
        : null;

    startTransition(async () => {
      const res = await updateOutletProfileSettingsAction({
        name,
        address: address.trim() || null,
        receiptFooter: receiptFooter.trim() || null,
        wifiName: wifiName.trim() || null,
        wifiPassword: wifiPassword.trim() || null,
        orderExpiryMinutes: exp,
        maxCashierDiscountPercent: maxPct,
        maxCashierDiscountAmount: maxAmt,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleToggleTaxCheckbox(nextChecked: boolean) {
    if (nextChecked && !canEnableTax) {
      toast.error(
        "Isi persentase pajak terlebih dahulu (contoh: 10 atau 11), lalu centang Aktifkan Pajak."
      );
      setTaxEnabled(false);
      taxPercentInputRef.current?.focus();
      return;
    }
    setTaxEnabled(nextChecked);
  }

  function handleToggleServiceCheckbox(nextChecked: boolean) {
    if (nextChecked && !canEnableService) {
      toast.error(
        "Isi persentase service charge terlebih dahulu (contoh: 5), lalu centang Aktifkan Service Charge."
      );
      setServiceEnabled(false);
      servicePercentInputRef.current?.focus();
      return;
    }
    setServiceEnabled(nextChecked);
  }

  function handleSaveTaxAndService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (taxEnabled && !canEnableTax) {
      toast.error(
        "Saklar pajak tidak bisa dinyalakan sebelum persentase pajak diisi (1-100%)."
      );
      taxPercentInputRef.current?.focus();
      return;
    }
    if (serviceEnabled && !canEnableService) {
      toast.error(
        "Saklar service charge tidak bisa dinyalakan sebelum persentase diisi (1-100%)."
      );
      servicePercentInputRef.current?.focus();
      return;
    }

    startTransition(async () => {
      const res = await updateTaxAndServiceSettingsAction({
        taxEnabled: canEnableTax ? taxEnabled : false,
        taxPercent: parsedTaxPercent,
        serviceEnabled: canEnableService ? serviceEnabled : false,
        servicePercent: parsedServicePercent,
        priceIncludesTax,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleFillSampleQris() {
    const cleanMerchant = (name || "1621 GROUP").toUpperCase().slice(0, 25);
    const lenMerchant = String(cleanMerchant.length).padStart(2, "0");
    const sampleStatic = `00020101021126610014ID.CO.QRIS.WWW01189360050300000898740215ID10241621000010303UMI51440014ID.CO.QRIS.WWW0215ID10241621000010303UMI5204581253033605802ID59${lenMerchant}${cleanMerchant}6007JAKARTA6105101106304`;
    const dynamicSample = generateDynamicQrisPayload({
      staticQrisPayload: `${sampleStatic}0000`,
      amountRupiah: 25000,
    });
    setQrisMerchantName(cleanMerchant);
    setQrisRawPayload(dynamicSample);
    setQrisEnabled(true);
    toast.success(
      `Kode QRIS contoh untuk ${cleanMerchant} berhasil diisi! Klik 'Simpan Status & Pengaturan QRIS' untuk menerbitkan.`
    );
  }

  async function handleUploadQrisImage(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningQrisImage(true);

    try {
      let bitmapWidth = 0;
      let bitmapHeight = 0;
      let drawSource: CanvasImageSource;

      if (typeof createImageBitmap !== "undefined") {
        try {
          const bmp = await createImageBitmap(file);
          bitmapWidth = bmp.width;
          bitmapHeight = bmp.height;
          drawSource = bmp;
        } catch {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const el = new Image();
              el.onload = () => resolve(el);
              el.onerror = reject;
              el.src = reader.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          bitmapWidth = img.naturalWidth || img.width;
          bitmapHeight = img.naturalHeight || img.height;
          drawSource = img;
        }
      } else {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = reader.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        bitmapWidth = img.naturalWidth || img.width;
        bitmapHeight = img.naturalHeight || img.height;
        drawSource = img;
      }

      const maxDim = 650;
      const scale = Math.min(1, maxDim / Math.max(bitmapWidth, bitmapHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmapWidth * scale));
      canvas.height = Math.max(1, Math.round(bitmapHeight * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(drawSource, 0, 0, canvas.width, canvas.height);
      }
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setQrisImagePreview(compressedDataUrl);

      let decodedQrisText: string | null = null;

      const cropZones = [
        { sx: 0, sy: 0, sw: 1, sh: 1 },
        { sx: 0.1, sy: 0.15, sw: 0.8, sh: 0.7 },
        { sx: 0.15, sy: 0.2, sw: 0.7, sh: 0.6 },
        { sx: 0.1, sy: 0.25, sw: 0.8, sh: 0.65 },
      ];

      const scanCanvas = document.createElement("canvas");
      const scanCtx = scanCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (scanCtx) {
        for (const zone of cropZones) {
          const srcX = Math.floor(bitmapWidth * zone.sx);
          const srcY = Math.floor(bitmapHeight * zone.sy);
          const srcW = Math.max(1, Math.floor(bitmapWidth * zone.sw));
          const srcH = Math.max(1, Math.floor(bitmapHeight * zone.sh));

          const targetMax = 900;
          const s = Math.min(1, targetMax / Math.max(srcW, srcH));
          scanCanvas.width = Math.max(1, Math.round(srcW * s));
          scanCanvas.height = Math.max(1, Math.round(srcH * s));

          scanCtx.fillStyle = "#FFFFFF";
          scanCtx.fillRect(0, 0, scanCanvas.width, scanCanvas.height);
          scanCtx.drawImage(
            drawSource,
            srcX,
            srcY,
            srcW,
            srcH,
            0,
            0,
            scanCanvas.width,
            scanCanvas.height
          );

          const imgData = scanCtx.getImageData(
            0,
            0,
            scanCanvas.width,
            scanCanvas.height
          );
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: "attemptBoth",
          });
          if (code?.data && code.data.trim().startsWith("000201")) {
            decodedQrisText = code.data.trim();
            break;
          }
        }
      }

      if (!decodedQrisText) {
        type BarcodeDetectorLike = {
          detect: (
            source: ImageBitmap
          ) => Promise<Array<{ rawValue?: string }>>;
        };
        const BarcodeDetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (opts?: {
              formats?: string[];
            }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;

        if (BarcodeDetectorCtor) {
          try {
            const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
            const results = await detector.detect(
              drawSource as unknown as ImageBitmap
            );
            const found = results.find((r) =>
              r.rawValue?.trim().startsWith("000201")
            );
            if (found?.rawValue) {
              decodedQrisText = found.rawValue.trim();
            }
          } catch {
            // Abaikan jika gagal
          }
        }
      }

      const cleanFallbackName = name.toLowerCase().includes("nusantara")
        ? "1621 GROUP"
        : name || "1621 GROUP";
      let detectedMerchant = qrisMerchantName.toLowerCase().includes("nusantara")
        ? cleanFallbackName
        : qrisMerchantName.trim() || cleanFallbackName;

      const finalPayload = compressedDataUrl;

      if (decodedQrisText) {
        const info = extractMerchantInfoFromQris(decodedQrisText);
        if (info.merchantName) {
          detectedMerchant = info.merchantName;
          setQrisMerchantName(info.merchantName);
        }
      } else {
        setQrisMerchantName(detectedMerchant);
      }

      setQrisRawPayload(finalPayload);
      setQrisEnabled(true);

      startTransition(async () => {
        const res = await updateQrisSettingsAction({
          qrisEnabled: true,
          qrisMerchantName: detectedMerchant || null,
          qrisRawPayload: finalPayload,
        });
        if (res.ok) {
          toast.success(
            decodedQrisText
              ? `QRIS berhasil dipindai & disimpan! Nama Merchant: ${detectedMerchant}`
              : `Gambar QRIS berhasil disimpan untuk Merchant: ${detectedMerchant}`
          );
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    } catch (err) {
      console.error("Gagal memproses file gambar QRIS:", err);
      toast.error(
        err instanceof Error
          ? `Gagal memproses gambar: ${err.message}`
          : "Gagal memproses file gambar QRIS. Pastikan format PNG/JPG."
      );
    } finally {
      setIsScanningQrisImage(false);
    }
  }

  function handleToggleQrisCheckbox(nextChecked: boolean) {
    if (nextChecked && !canEnableQris) {
      toast.error(
        "Upload gambar QRIS atau klik 'Isi Contoh QRIS' terlebih dahulu sebelum mengaktifkan pembayaran QRIS."
      );
      setQrisEnabled(false);
      return;
    }
    setQrisEnabled(nextChecked);
  }

  function handleSaveQris(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const nextEnabled = canEnableQris ? qrisEnabled : false;
      const res = await updateQrisSettingsAction({
        qrisEnabled: nextEnabled,
        qrisMerchantName: qrisMerchantName.trim() || null,
        qrisRawPayload: qrisRawPayload.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        nextEnabled
          ? "Pembayaran QRIS di Meja diaktifkan dan disimpan."
          : "Pembayaran QRIS di Meja dinonaktifkan dan disimpan."
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1. PROFIL OUTLET, WIFI STRUK & BATAS DISKON KASIR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            1. Profil Outlet, WiFi Struk &amp; Batas Diskon Kasir
          </CardTitle>
          <CardDescription>
            Atur identitas toko &amp; info WiFi pada struk, batas waktu
            pembayaran order pelanggan (default 15 menit), dan batas diskon
            maksimum untuk kasir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveOutletProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Nama Outlet</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Alamat Outlet</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Merdeka No. 1621, Jakarta"
                disabled={isPending}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Nama WiFi (SSID di Struk)
                </label>
                <Input
                  value={wifiName}
                  onChange={(e) => setWifiName(e.target.value)}
                  placeholder="Contoh: 1621-Guest-WiFi"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Password WiFi (di Struk)
                </label>
                <Input
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="Kosongkan jika bebas"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                Teks Footer Struk
              </label>
              <Input
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Terima kasih atas kunjungan Anda!"
                disabled={isPending}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-slate-300">
                  Kedaluwarsa Order (Menit)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={expiryMinutes}
                  onChange={(e) => setExpiryMinutes(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-slate-300">
                  Batas Diskon Kasir (%)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={maxDiscountPercent}
                  onChange={(e) => setMaxDiscountPercent(e.target.value)}
                  placeholder="Kosong = tanpa batas"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-slate-300">
                  Batas Diskon Kasir (Rp)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="contoh: 50000"
                  disabled={isPending}
                />
                {maxDiscountAmount &&
                Number.isInteger(Number(maxDiscountAmount)) ? (
                  <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                    {formatRupiah(Number(maxDiscountAmount))}
                  </p>
                ) : null}
              </div>
            </div>

            <Button type="submit" className="min-h-11 w-full" disabled={isPending}>
              Simpan Profil, WiFi &amp; Batas Diskon
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2. PENGATURAN PAJAK & SERVICE CHARGE */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              2. Pajak &amp; Service Charge
            </CardTitle>
            <Badge
              variant={
                taxEnabled || serviceEnabled ? "success" : "secondary"
              }
            >
              {taxEnabled || serviceEnabled ? "Aktif" : "Mati (Default)"}
            </Badge>
          </div>
          <CardDescription>
            Isi persentase terlebih dahulu lalu centang{" "}
            <strong>Aktifkan Pajak / Service Charge</strong>, kemudian klik{" "}
            <strong>Simpan Pengaturan Pajak &amp; Service</strong>. Perubahan
            hanya berlaku untuk order baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTaxAndService} className="space-y-4">
            <div className="rounded-xl border border-zinc-200 dark:border-slate-800 p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Persentase Pajak / PB1 (%)
                </label>
                <Input
                  ref={taxPercentInputRef}
                  type="text"
                  inputMode="decimal"
                  value={taxPercentStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTaxPercentStr(val);
                    const parsed = parsePercentValue(val);
                    if (parsed === null || parsed <= 0 || parsed > 100) {
                      setTaxEnabled(false);
                    }
                  }}
                  placeholder="Kosongkan jika belum dipakai (contoh: 10 atau 11)"
                  disabled={isPending}
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium select-none">
                <input
                  type="checkbox"
                  checked={taxEnabled && canEnableTax}
                  disabled={isPending}
                  onChange={(e) => handleToggleTaxCheckbox(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 accent-emerald-600 dark:border-slate-600 cursor-pointer"
                />
                <span>
                  Aktifkan Pajak{" "}
                  {!canEnableTax ? (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                      (Isi persentase pajak di atas terlebih dahulu)
                    </span>
                  ) : taxEnabled ? (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      (Pajak {parsedTaxPercent}% siap diaktifkan)
                    </span>
                  ) : null}
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-slate-800 p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Persentase Service Charge (%)
                </label>
                <Input
                  ref={servicePercentInputRef}
                  type="text"
                  inputMode="decimal"
                  value={servicePercentStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setServicePercentStr(val);
                    const parsed = parsePercentValue(val);
                    if (parsed === null || parsed <= 0 || parsed > 100) {
                      setServiceEnabled(false);
                    }
                  }}
                  placeholder="Kosongkan jika belum dipakai (contoh: 5)"
                  disabled={isPending}
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium select-none">
                <input
                  type="checkbox"
                  checked={serviceEnabled && canEnableService}
                  disabled={isPending}
                  onChange={(e) => handleToggleServiceCheckbox(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 accent-emerald-600 dark:border-slate-600 cursor-pointer"
                />
                <span>
                  Aktifkan Service Charge{" "}
                  {!canEnableService ? (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                      (Isi persentase service di atas terlebih dahulu)
                    </span>
                  ) : serviceEnabled ? (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      (Service {parsedServicePercent}% siap diaktifkan)
                    </span>
                  ) : null}
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                Mode Perhitungan Harga Produk
              </label>
              <select
                value={priceIncludesTax ? "INCLUSIVE" : "EXCLUSIVE"}
                onChange={(e) =>
                  setPriceIncludesTax(e.target.value === "INCLUSIVE")
                }
                disabled={isPending}
                className="flex min-h-11 w-full rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-zinc-900 dark:text-slate-100"
              >
                <option value="EXCLUSIVE">
                  Harga belum termasuk pajak (pajak ditambahkan ke total)
                </option>
                <option value="INCLUSIVE">
                  Harga sudah termasuk pajak (total tetap, pajak tampil di
                  struk)
                </option>
              </select>
            </div>

            <Button type="submit" className="min-h-11 w-full" disabled={isPending}>
              Simpan Pengaturan Pajak &amp; Service
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. SECTION KHUSUS POST / UPLOAD & SAKLAR QRIS TOKO */}
      <Card className="border-sky-200 dark:border-slate-800 shadow-xs lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-[#1E88E5]" />
              3. Post / Upload &amp; Status QRIS Toko (Pembayaran QRIS di Meja)
            </CardTitle>
            <Badge variant={qrisEnabled && canEnableQris ? "success" : "secondary"}>
              {qrisEnabled && canEnableQris ? "QRIS Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <CardDescription>
            Upload gambar stiker/poster QRIS toko Anda untuk dipindai otomatis,
            atau tempelkan kode QRIS statis (diawali <code>000201...</code>).
            Gunakan centang di bawah untuk{" "}
            <strong>mengaktifkan atau menonaktifkan</strong> pilihan bayar QRIS
            pada layar pelanggan meja.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveQris} className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-sky-300 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-900/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Upload Gambar / Foto QRIS Toko
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih file foto QRIS (PNG/JPG). Sistem akan otomatis
                    membaca kode QRIS &amp; Nama Merchant Anda.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1976D2] transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    <span>
                      {isScanningQrisImage
                        ? "Memindai QR..."
                        : "Pilih Gambar QRIS"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadQrisImage}
                      className="hidden"
                      disabled={isPending || isScanningQrisImage}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={handleFillSampleQris}
                    disabled={isPending}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                    Isi Contoh QRIS
                  </Button>
                </div>
              </div>

              {qrisImagePreview ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisImagePreview}
                    alt="Poster QRIS"
                    className="h-16 w-16 rounded border border-slate-200 bg-white object-contain"
                  />
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Gambar QRIS Toko Tersimpan
                    </p>
                    <p>
                      Akan tampil di Layar Pelanggan saat status QRIS diaktifkan.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Nama Merchant QRIS
                </label>
                <Input
                  value={qrisMerchantName}
                  onChange={(e) => setQrisMerchantName(e.target.value)}
                  placeholder="1621 GROUP - LATTESPACE"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium">
                    String Payload QRIS Statis (Opsional jika upload gambar)
                  </label>
                  {isUploadedQrisImage ? (
                    <Badge variant="success" className="text-[10px]">
                      Gambar QRIS Upload
                    </Badge>
                  ) : null}
                </div>
                <textarea
                  rows={2}
                  value={isUploadedQrisImage ? "" : qrisRawPayload}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQrisRawPayload(val);
                    if (val.trim().startsWith("000201")) {
                      const info = extractMerchantInfoFromQris(val.trim());
                      if (info.merchantName && !qrisMerchantName.trim()) {
                        setQrisMerchantName(info.merchantName);
                      }
                    } else if (!val.trim().startsWith("data:image/")) {
                      setQrisEnabled(false);
                    }
                  }}
                  placeholder={
                    isUploadedQrisImage
                      ? "Gambar QRIS toko sudah terpasang."
                      : "00020101021126..."
                  }
                  disabled={isPending}
                  className="w-full rounded-lg border border-zinc-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 font-mono text-xs text-zinc-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-sky-500"
                />
              </div>
            </div>

            {canEnableQris ? (
              <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 sm:flex-row">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Pratinjau QRIS Meja Siap Pakai</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Merchant:{" "}
                    <strong>{qrisMerchantName || initialOutlet.name}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Contoh tampilan tagihan <strong>Rp 25.000</strong> untuk{" "}
                    <strong>MEJA-01</strong>.
                  </p>
                </div>
                {isUploadedQrisImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={trimmedQrisPayload}
                    alt="Pratinjau QRIS Toko"
                    className="h-28 w-28 shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 object-contain shadow-2xs"
                  />
                ) : (
                  <div
                    className="h-28 w-28 shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xs"
                    dangerouslySetInnerHTML={{
                      __html: generateQrSvgString(trimmedQrisPayload, 1),
                    }}
                  />
                )}
              </div>
            ) : null}

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium select-none">
              <input
                type="checkbox"
                checked={qrisEnabled && canEnableQris}
                disabled={isPending}
                onChange={(e) => handleToggleQrisCheckbox(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 accent-emerald-600 dark:border-slate-600 cursor-pointer"
              />
              <span>
                Aktifkan Pembayaran QRIS di Meja{" "}
                {!canEnableQris ? (
                  <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                    (Upload gambar QRIS atau klik &apos;Isi Contoh QRIS&apos; terlebih dahulu)
                  </span>
                ) : (
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    (Centang untuk aktifkan, hilangkan centang untuk nonaktifkan)
                  </span>
                )}
              </span>
            </label>

            <Button type="submit" className="min-h-11 w-full" disabled={isPending}>
              {qrisEnabled && canEnableQris
                ? "Simpan & Aktifkan QRIS Toko"
                : "Simpan Status QRIS Toko (Nonaktif)"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
