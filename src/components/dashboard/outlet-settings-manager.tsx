"use client";

import * as React from "react";
import jsQR from "jsqr";
import { Upload, QrCode, CheckCircle2, Sparkles, Mail } from "lucide-react";
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
import type {
  InstantNotificationEvents,
  NotificationSettingsRow,
  OutletRow,
} from "@/lib/types/database";
import {
  updateNotificationSettingsAction,
  updateOutletProfileSettingsAction,
  updateQrisSettingsAction,
  updateTaxAndServiceSettingsAction,
} from "@/server/master-data";
import { triggerManualMonthlyReportAction } from "@/server/owner-notifications";

export function OutletSettingsManager({
  initialOutlet,
  initialNotification,
}: {
  initialOutlet: OutletRow;
  initialNotification: NotificationSettingsRow;
}) {
  // 1. State Profil Outlet & Batas Diskon Kasir
  const [name, setName] = React.useState(initialOutlet.name);
  const [address, setAddress] = React.useState(initialOutlet.address ?? "");
  const [receiptFooter, setReceiptFooter] = React.useState(
    initialOutlet.receipt_footer ?? ""
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

  // 4. State Notifikasi Email Owner
  const [ownerEmail, setOwnerEmail] = React.useState(
    initialNotification.owner_email ?? ""
  );
  const [monthlyReportEnabled, setMonthlyReportEnabled] = React.useState(
    initialNotification.monthly_report_enabled
  );
  const [instantEvents, setInstantEvents] =
    React.useState<InstantNotificationEvents>(
      initialNotification.instant_events
    );

  const [isPending, startTransition] = React.useTransition();

  const parsedTaxPercent =
    taxPercentStr.trim().length > 0 ? Number(taxPercentStr) : null;
  const canEnableTax =
    parsedTaxPercent !== null &&
    Number.isFinite(parsedTaxPercent) &&
    parsedTaxPercent > 0 &&
    parsedTaxPercent <= 100;

  const parsedServicePercent =
    servicePercentStr.trim().length > 0 ? Number(servicePercentStr) : null;
  const canEnableService =
    parsedServicePercent !== null &&
    Number.isFinite(parsedServicePercent) &&
    parsedServicePercent > 0 &&
    parsedServicePercent <= 100;

  const trimmedQrisPayload = qrisRawPayload.trim();
  const isUploadedQrisImage = trimmedQrisPayload.startsWith("data:image/");
  const isEmvQrisPayload = trimmedQrisPayload.startsWith("000201");
  const canEnableQris = isEmvQrisPayload || isUploadedQrisImage;

  function handleSaveOutletProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const exp = Number.parseInt(expiryMinutes, 10);
    const maxPct =
      maxDiscountPercent.trim().length > 0 ? Number(maxDiscountPercent) : null;
    const maxAmt =
      maxDiscountAmount.trim().length > 0
        ? Number.parseInt(maxDiscountAmount, 10)
        : null;

    startTransition(async () => {
      const res = await updateOutletProfileSettingsAction({
        name,
        address: address.trim() || null,
        receiptFooter: receiptFooter.trim() || null,
        orderExpiryMinutes: exp,
        maxCashierDiscountPercent: maxPct,
        maxCashierDiscountAmount: maxAmt,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  function handleSaveTaxAndService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (taxEnabled && !canEnableTax) {
      toast.error(
        "Saklar pajak tidak bisa dinyalakan sebelum persentase pajak diisi (1-100%)."
      );
      return;
    }
    if (serviceEnabled && !canEnableService) {
      toast.error(
        "Saklar service charge tidak bisa dinyalakan sebelum persentase diisi (1-100%)."
      );
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
    // Ambil base statis dengan CRC valid
    setQrisMerchantName(cleanMerchant);
    setQrisRawPayload(dynamicSample);
    setQrisEnabled(true);
    toast.success(
      `Kode QRIS contoh untuk ${cleanMerchant} berhasil diisi! Klik 'Simpan Pengaturan QRIS' untuk mengaktifkan.`
    );
  }

  async function handleUploadQrisImage(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningQrisImage(true);

    try {
      const bitmap = await createImageBitmap(file);

      // 1. Kompres gambar QRIS ke Data URL agar tersimpan permanen di database
      const maxDim = 650;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setQrisImagePreview(compressedDataUrl);

      let decodedQrisText: string | null = null;

      // 2. Pindai QR Code dengan jsQR (berfungsi di semua browser Windows/Mac/HP)
      // Kita pindai gambar penuh dan beberapa area crop tengah poster QRIS
      const cropZones = [
        { sx: 0, sy: 0, sw: 1, sh: 1 }, // Gambar penuh
        { sx: 0.1, sy: 0.15, sw: 0.8, sh: 0.7 }, // Area tengah poster QRIS
        { sx: 0.15, sy: 0.2, sw: 0.7, sh: 0.6 }, // Fokus kotak QR tengah
        { sx: 0.1, sy: 0.25, sw: 0.8, sh: 0.65 }, // Fokus tengah-bawah poster
      ];

      const scanCanvas = document.createElement("canvas");
      const scanCtx = scanCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (scanCtx) {
        for (const zone of cropZones) {
          const srcX = Math.floor(bitmap.width * zone.sx);
          const srcY = Math.floor(bitmap.height * zone.sy);
          const srcW = Math.max(1, Math.floor(bitmap.width * zone.sw));
          const srcH = Math.max(1, Math.floor(bitmap.height * zone.sh));

          const targetMax = 900;
          const s = Math.min(1, targetMax / Math.max(srcW, srcH));
          scanCanvas.width = Math.max(1, Math.round(srcW * s));
          scanCanvas.height = Math.max(1, Math.round(srcH * s));

          scanCtx.fillStyle = "#FFFFFF";
          scanCtx.fillRect(0, 0, scanCanvas.width, scanCanvas.height);
          scanCtx.drawImage(
            bitmap,
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

      // 3. Fallback ke BarcodeDetector bawaan browser jika ada
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
            const results = await detector.detect(bitmap);
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

      // Simpan gambar poster QRIS Anda agar tampil persis sesuai foto yang di-upload,
      // namun ambil Nama Merchant asli (Tag 59) dari QRIS yang berhasil dipindai!
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

      // Langsung simpan ke database otomatis begitu gambar diupload
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
        } else {
          toast.error(res.message);
        }
      });
    } catch {
      toast.error("Gagal memproses file gambar QRIS. Pastikan format PNG/JPG.");
    } finally {
      setIsScanningQrisImage(false);
    }
  }

  function handleSaveQris(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateQrisSettingsAction({
        qrisEnabled: canEnableQris ? qrisEnabled : false,
        qrisMerchantName: qrisMerchantName.trim() || null,
        qrisRawPayload: qrisRawPayload.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  function handleSaveNotification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateNotificationSettingsAction({
        ownerEmail: ownerEmail.trim() || null,
        monthlyReportEnabled,
        instantEvents,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1. PROFIL OUTLET & BATAS DISKON KASIR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            1. Profil Outlet &amp; Batas Diskon Kasir
          </CardTitle>
          <CardDescription>
            Atur identitas toko pada struk, batas waktu pembayaran order
            pelanggan (default 15 menit), dan batas diskon maksimum untuk kasir.
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
                <label className="block text-xs font-medium text-zinc-700">
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
                <label className="block text-xs font-medium text-zinc-700">
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
                <label className="block text-xs font-medium text-zinc-700">
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
                  <p className="text-[11px] text-zinc-500">
                    {formatRupiah(Number(maxDiscountAmount))}
                  </p>
                ) : null}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              Simpan Profil &amp; Batas Diskon
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
            Default mati dan persentase kosong. Saklar{" "}
            <strong>tidak bisa dinyalakan sebelum persentase diisi</strong>.
            Perubahan hanya berlaku untuk order baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTaxAndService} className="space-y-4">
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Persentase Pajak / PB1 (%)
                </label>
                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step="0.1"
                  value={taxPercentStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTaxPercentStr(val);
                    if (!val || Number(val) <= 0) {
                      setTaxEnabled(false);
                    }
                  }}
                  placeholder="Kosongkan jika belum dipakai (contoh: 10)"
                  disabled={isPending}
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={taxEnabled && canEnableTax}
                  disabled={!canEnableTax || isPending}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 disabled:opacity-40"
                />
                <span>
                  Aktifkan Pajak{" "}
                  {!canEnableTax ? (
                    <span className="text-xs font-normal text-amber-700">
                      (Isi persentase pajak terlebih dahulu)
                    </span>
                  ) : null}
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Persentase Service Charge (%)
                </label>
                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step="0.1"
                  value={servicePercentStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setServicePercentStr(val);
                    if (!val || Number(val) <= 0) {
                      setServiceEnabled(false);
                    }
                  }}
                  placeholder="Kosongkan jika belum dipakai (contoh: 5)"
                  disabled={isPending}
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={serviceEnabled && canEnableService}
                  disabled={!canEnableService || isPending}
                  onChange={(e) => setServiceEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 disabled:opacity-40"
                />
                <span>
                  Aktifkan Service Charge{" "}
                  {!canEnableService ? (
                    <span className="text-xs font-normal text-amber-700">
                      (Isi persentase service terlebih dahulu)
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
                className="flex min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
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

            <Button type="submit" className="w-full" disabled={isPending}>
              Simpan Pengaturan Pajak &amp; Service
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. SECTION KHUSUS POST / UPLOAD QRIS TOKO */}
      <Card className="border-sky-200 dark:border-slate-800 shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-[#1E88E5]" />
              3. Post / Upload QRIS Toko (Pembayaran QRIS di Meja)
            </CardTitle>
            <Badge variant={qrisEnabled && canEnableQris ? "success" : "secondary"}>
              {qrisEnabled && canEnableQris ? "QRIS Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <CardDescription>
            Upload gambar stiker/poster QRIS toko Anda untuk dipindai otomatis,
            atau tempelkan kode QRIS statis (diawali <code>000201...</code>).
            Sistem otomatis menghasilkan QRIS dengan nominal pas sesuai tagihan
            dan label meja (<code>MEJA-XX</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveQris} className="space-y-4">
            {/* Kotak Upload Poster / Gambar QRIS */}
            <div className="rounded-xl border-2 border-dashed border-sky-300 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-900/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Upload Gambar / Foto QRIS Toko
                  </p>
                  <p className="text-xs text-slate-500">
                    Pilih file foto QRIS (PNG/JPG). Sistem akan otomatis
                    membaca kode QRIS &amp; Nama Merchant Anda.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1976D2] transition-colors">
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
                    onClick={handleFillSampleQris}
                    disabled={isPending}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                    Isi Contoh QRIS
                  </Button>
                </div>
              </div>

              {qrisImagePreview ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-sky-200 bg-white p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisImagePreview}
                    alt="Poster QRIS"
                    className="h-16 w-16 rounded border border-slate-200 object-contain"
                  />
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-emerald-700">
                      Gambar QRIS Toko Aktif &amp; Tersimpan
                    </p>
                    <p>
                      Gambar QRIS ini akan muncul di Popup Kasir (Order Manual)
                      serta di Layar Pelanggan saat memilih pembayaran QRIS.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

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
                  String Payload QRIS Statis (EMVCo — Opsional jika sudah upload gambar)
                </label>
                {isUploadedQrisImage ? (
                  <Badge variant="success" className="text-[10px]">
                    Menggunakan Gambar QRIS Upload
                  </Badge>
                ) : null}
              </div>
              <textarea
                rows={3}
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
                    ? "Gambar QRIS toko sudah terpasang. (Tempel kode 000201... di sini hanya jika ingin mengganti dengan QRIS teks EMVCo)"
                    : "00020101021126..."
                }
                disabled={isPending}
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
              />
            </div>

            {/* Pratinjau Visual QRIS Dinamis / Gambar Aktif */}
            {canEnableQris ? (
              <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 sm:flex-row">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Pratinjau QRIS Kasir &amp; Meja Siap Pakai</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Merchant:{" "}
                    <strong>{qrisMerchantName || initialOutlet.name}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
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

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={qrisEnabled && canEnableQris}
                disabled={!canEnableQris || isPending}
                onChange={(e) => setQrisEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 disabled:opacity-40"
              />
              <span>
                Aktifkan Pembayaran QRIS di Meja{" "}
                {!canEnableQris ? (
                  <span className="text-xs font-normal text-amber-700">
                    (Upload gambar QRIS atau klik &apos;Isi Contoh QRIS&apos; terlebih dahulu)
                  </span>
                ) : null}
              </span>
            </label>

            <Button type="submit" className="w-full" disabled={isPending}>
              Simpan &amp; Terbitkan QRIS Toko
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 4. PENGATURAN NOTIFIKASI EMAIL OWNER */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            4. Notifikasi Email ke Owner
          </CardTitle>
          <CardDescription>
            Atur pengiriman laporan bulanan otomatis dan email langsung saat
            terjadi kejadian sensitif (refund, pembatalan setelah bayar, diskon,
            dan perubahan harga/pengaturan).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveNotification} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                Alamat Email Owner
              </label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@1621fnb.id"
                disabled={isPending}
              />
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={monthlyReportEnabled}
                onChange={(e) => setMonthlyReportEnabled(e.target.checked)}
                disabled={isPending}
                className="h-5 w-5 rounded border-zinc-300"
              />
              Kirim Laporan Bulanan Otomatis (Penjualan Kotor, Refund, Bersih,
              Diskon)
            </label>

            <div className="rounded-xl border border-zinc-200 p-4 space-y-2">
              <p className="text-sm font-semibold">
                Kejadian Sensitif (Kirim Email Langsung):
              </p>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={instantEvents.refund}
                  onChange={(e) =>
                    setInstantEvents((prev) => ({
                      ...prev,
                      refund: e.target.checked,
                    }))
                  }
                  disabled={isPending}
                  className="h-5 w-5 rounded border-zinc-300"
                />
                Saat terjadi Refund Tunai
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={instantEvents.paid_cancellation}
                  onChange={(e) =>
                    setInstantEvents((prev) => ({
                      ...prev,
                      paid_cancellation: e.target.checked,
                    }))
                  }
                  disabled={isPending}
                  className="h-5 w-5 rounded border-zinc-300"
                />
                Saat Pembatalan Order yang Sudah Dibayar (PAID / READY / SERVED)
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={instantEvents.discount}
                  onChange={(e) =>
                    setInstantEvents((prev) => ({
                      ...prev,
                      discount: e.target.checked,
                    }))
                  }
                  disabled={isPending}
                  className="h-5 w-5 rounded border-zinc-300"
                />
                Saat Kasir Memberikan Diskon Order
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={instantEvents.price_or_setting_change}
                  onChange={(e) =>
                    setInstantEvents((prev) => ({
                      ...prev,
                      price_or_setting_change: e.target.checked,
                    }))
                  }
                  disabled={isPending}
                  className="h-5 w-5 rounded border-zinc-300"
                />
                Saat Ada Perubahan Harga Menu atau Pengaturan Pajak/Outlet
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              Simpan Pengaturan Notifikasi Email
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isPending || !ownerEmail.trim()}
              onClick={() => {
                startTransition(async () => {
                  const res = await triggerManualMonthlyReportAction();
                  if (res.ok) {
                    toast.success(res.message);
                  } else {
                    toast.error(res.message);
                  }
                });
              }}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              Kirim / Uji Laporan Bulanan Sekarang (Catat di Audit)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

