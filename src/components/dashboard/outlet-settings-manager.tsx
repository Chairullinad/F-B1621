"use client";

import * as React from "react";
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
  const [qrisMerchantName, setQrisMerchantName] = React.useState(
    initialOutlet.qris_merchant_name ?? initialOutlet.name
  );
  const [qrisRawPayload, setQrisRawPayload] = React.useState(
    initialOutlet.qris_raw_payload ?? ""
  );
  const [qrisEnabled, setQrisEnabled] = React.useState(
    initialOutlet.qris_enabled
  );

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

  const canEnableQris = qrisRawPayload.trim().startsWith("000201");

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

      {/* 3. PENGATURAN QRIS TOKO */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              3. Pembayaran QRIS di Meja (Tanpa Payment Gateway)
            </CardTitle>
            <Badge variant={qrisEnabled ? "success" : "secondary"}>
              {qrisEnabled ? "QRIS Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <CardDescription>
            Tempelkan string kode QRIS statis milik toko Anda (diawali{" "}
            <code>000201...</code>). Sistem otomatis menghasilkan QRIS dengan
            nominal pas dan label nomor meja (<code>MEJA-XX</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveQris} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                Nama Merchant QRIS
              </label>
              <Input
                value={qrisMerchantName}
                onChange={(e) => setQrisMerchantName(e.target.value)}
                placeholder="KAFE NUSANTARA 1621"
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                String Payload QRIS Statis (EMVCo)
              </label>
              <textarea
                rows={3}
                value={qrisRawPayload}
                onChange={(e) => {
                  const val = e.target.value;
                  setQrisRawPayload(val);
                  if (!val.trim().startsWith("000201")) {
                    setQrisEnabled(false);
                  }
                }}
                placeholder="00020101021126..."
                disabled={isPending}
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
              />
            </div>

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
                    (Isi payload QRIS statis terlebih dahulu)
                  </span>
                ) : null}
              </span>
            </label>

            <Button type="submit" className="w-full" disabled={isPending}>
              Simpan Pengaturan QRIS
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
