"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Printer,
  Receipt,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothPrintCapabilities,
  getBluetoothPrinterState,
  printEscPosOverBluetooth,
  subscribeBluetoothPrinterState,
  triggerRawBtPrint,
  tryReconnectSavedBluetoothPrinter,
  type BluetoothPrintCapabilities,
  type BluetoothPrinterState,
} from "@/lib/bluetooth-printer";
import { formatDateTimeWIB } from "@/lib/datetime";
import {
  buildBluetoothTestPrintEscPosBytes,
  buildOrderReceiptEscPosBytes,
  type ReceiptPaperSize,
  type ReceiptPrintMode,
} from "@/lib/escpos";
import { formatRupiah } from "@/lib/money";
import {
  recordReceiptReprintAction,
  type OrderReceiptDetail,
} from "@/server/cashier";
import { recordKitchenTicketPrintAction } from "@/server/kitchen-waiter";

const PAPER_SIZE_STORAGE_KEY = "1621_receipt_paper_size";
const PRINT_MODE_STORAGE_KEY = "1621_receipt_print_mode";

export function ReceiptPrintView({
  receipt,
  kitchenOnly = false,
  backHref = "/kasir",
  backLabel = "Kembali ke Kasir",
}: {
  receipt: OrderReceiptDetail;
  kitchenOnly?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("58mm");
  const [printMode, setPrintMode] = useState<ReceiptPrintMode>(
    kitchenOnly ? "kitchen" : "both"
  );
  const [printCount, setPrintCount] = useState(0);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);
  const [printerState, setPrinterState] = useState<BluetoothPrinterState>({
    status: "disconnected",
    deviceId: null,
    deviceName: null,
  });
  const [capabilities, setCapabilities] =
    useState<BluetoothPrintCapabilities | null>(null);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [printerSuccess, setPrinterSuccess] = useState<string | null>(null);
  const [showBluetoothPanel, setShowBluetoothPanel] = useState(false);
  const autoprintHandledRef = useRef(false);

  async function recordPrintAudit(): Promise<void> {
    try {
      const res = kitchenOnly
        ? await recordKitchenTicketPrintAction({
            orderId: receipt.orderId,
          })
        : await recordReceiptReprintAction({
            orderId: receipt.orderId,
          });
      if (res.ok) {
        setPrintCount((c) => c + 1);
        setAuditNotice(res.message);
      }
    } catch {
      // Tetap lanjutkan proses cetak meski audit UI gagal ter-update
    }
  }

  function updatePaperSize(next: ReceiptPaperSize) {
    setPaperSize(next);
    try {
      window.localStorage.setItem(PAPER_SIZE_STORAGE_KEY, next);
    } catch {
      // Abaikan error storage
    }
  }

  function updatePrintMode(next: ReceiptPrintMode) {
    setPrintMode(next);
    try {
      window.localStorage.setItem(PRINT_MODE_STORAGE_KEY, next);
    } catch {
      // Abaikan error storage
    }
  }

  useEffect(() => {
    setCapabilities(getBluetoothPrintCapabilities());
    const unsubscribe = subscribeBluetoothPrinterState(setPrinterState);

    let resolvedPaper: ReceiptPaperSize = "58mm";
    let resolvedMode: ReceiptPrintMode = kitchenOnly ? "kitchen" : "both";

    try {
      const savedPaper = window.localStorage.getItem(PAPER_SIZE_STORAGE_KEY);
      if (savedPaper === "58mm" || savedPaper === "80mm") {
        resolvedPaper = savedPaper;
        setPaperSize(savedPaper);
      }
      if (!kitchenOnly) {
        const savedMode = window.localStorage.getItem(PRINT_MODE_STORAGE_KEY);
        if (
          savedMode === "both" ||
          savedMode === "customer" ||
          savedMode === "kitchen"
        ) {
          resolvedMode = savedMode;
          setPrintMode(savedMode);
        }
      }
    } catch {
      // Gunakan default
    }

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (
      !kitchenOnly &&
      (modeParam === "both" ||
        modeParam === "kitchen" ||
        modeParam === "customer")
    ) {
      resolvedMode = modeParam;
      setPrintMode(modeParam);
    }

    const sizeParam = params.get("size");
    if (sizeParam === "58mm" || sizeParam === "80mm") {
      resolvedPaper = sizeParam;
      setPaperSize(sizeParam);
    }

    let cancelled = false;
    const isAutoprint = params.get("autoprint") === "1";

    void (async () => {
      await tryReconnectSavedBluetoothPrinter();
      if (cancelled || !isAutoprint || autoprintHandledRef.current) return;
      autoprintHandledRef.current = true;

      const currentBt = getBluetoothPrinterState();
      if (currentBt.status === "connected") {
        try {
          const payload = buildOrderReceiptEscPosBytes(receipt, {
            paperSize: resolvedPaper,
            mode: resolvedMode,
          });
          const result = await printEscPosOverBluetooth(payload);
          if (!cancelled) {
            setPrinterSuccess(
              `Struk #${receipt.orderNo} otomatis dicetak ke Bluetooth (${result.deviceName}).`
            );
            toast.success(
              `Struk dikirim ke printer Bluetooth (${result.deviceName}).`
            );
            await recordPrintAudit();
          }
          return;
        } catch {
          // Jatuhkan ke window.print() bila auto Bluetooth gagal
        }
      }

      setTimeout(() => {
        if (!cancelled) {
          window.print();
        }
      }, 300);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.orderId]);

  async function handleConnectBluetooth() {
    setPrinterError(null);
    setPrinterSuccess(null);
    try {
      const state = await connectBluetoothPrinter();
      const label = state.deviceName ?? "Printer Thermal Bluetooth";
      setPrinterSuccess(`Berhasil terhubung ke ${label}.`);
      toast.success(`Terhubung ke printer ${label}`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menghubungkan printer Bluetooth.";
      setPrinterError(msg);
      toast.error(msg);
    }
  }

  function handleDisconnectBluetooth() {
    disconnectBluetoothPrinter();
    setPrinterError(null);
    setPrinterSuccess("Koneksi printer Bluetooth diputuskan.");
  }

  async function handlePrintBluetooth() {
    setPrinterError(null);
    setPrinterSuccess(null);
    try {
      const payload = buildOrderReceiptEscPosBytes(receipt, {
        paperSize,
        mode: printMode,
      });
      const result = await printEscPosOverBluetooth(payload);
      await recordPrintAudit();
      const msg = `Struk #${receipt.orderNo} berhasil dicetak ke ${result.deviceName} (${paperSize}).`;
      setPrinterSuccess(msg);
      toast.success(msg);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal mencetak ke printer Bluetooth.";
      setPrinterError(msg);
      toast.error(msg);
    }
  }

  async function handleTestPrintBluetooth() {
    setPrinterError(null);
    setPrinterSuccess(null);
    try {
      const payload = buildBluetoothTestPrintEscPosBytes(
        paperSize,
        printerState.deviceName ?? undefined
      );
      const result = await printEscPosOverBluetooth(payload);
      const msg = `Tes cetak (${paperSize}) berhasil dikirim ke ${result.deviceName}.`;
      setPrinterSuccess(msg);
      toast.success(msg);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal mengirim tes cetak ke printer Bluetooth.";
      setPrinterError(msg);
      toast.error(msg);
    }
  }

  async function handleRawBtPrint() {
    setPrinterError(null);
    setPrinterSuccess(null);
    const payload = buildOrderReceiptEscPosBytes(receipt, {
      paperSize,
      mode: printMode,
    });
    triggerRawBtPrint(payload);
    await recordPrintAudit();
    setPrinterSuccess(
      `Perintah cetak ESC/POS (${paperSize}) dikirim ke aplikasi RawBT Android.`
    );
  }

  async function handleBrowserPrint() {
    await recordPrintAudit();
    window.print();
  }

  const totalQty = receipt.items.reduce((acc, item) => acc + item.qty, 0);
  const isBtBusy =
    printerState.status === "connecting" || printerState.status === "printing";
  const isBtConnected = printerState.status === "connected";

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 print:max-w-none print:p-0">
      <style>{`
        @media print {
          @page {
            size: ${paperSize} auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Toolbar (Disembunyikan saat print browser) */}
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={backHref}>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {backLabel}
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={paperSize === "58mm" ? "default" : "outline"}
              className="min-h-[44px]"
              onClick={() => updatePaperSize("58mm")}
            >
              58mm
            </Button>
            <Button
              type="button"
              variant={paperSize === "80mm" ? "default" : "outline"}
              className="min-h-[44px]"
              onClick={() => updatePaperSize("80mm")}
            >
              80mm
            </Button>
            <Button
              type="button"
              className="min-h-[44px] bg-blue-600 text-white hover:bg-blue-700"
              disabled={isBtBusy}
              onClick={handlePrintBluetooth}
            >
              <Bluetooth className="mr-1.5 h-4 w-4" />
              {printerState.status === "printing"
                ? "Mencetak..."
                : isBtConnected
                  ? printCount > 0
                    ? "Cetak Ulang Bluetooth"
                    : "Cetak Bluetooth"
                  : "Hubungkan & Cetak Bluetooth"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={handleBrowserPrint}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Cetak Browser / PDF
            </Button>
          </div>
        </div>

        {/* Panel Koneksi Printer Thermal Bluetooth (Default: Tersembunyi / Collapse) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
          <button
            type="button"
            aria-expanded={showBluetoothPanel}
            onClick={() => setShowBluetoothPanel((prev) => !prev)}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 cursor-pointer"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Bluetooth className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>Pengaturan Printer Bluetooth &amp; RawBT</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isBtConnected
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isBtConnected
                  ? printerState.deviceName ?? "Terhubung"
                  : "Belum terhubung"}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>{showBluetoothPanel ? "Sembunyikan" : "Extend"}</span>
              {showBluetoothPanel ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </button>

          {showBluetoothPanel && (
            <div className="space-y-2.5 border-t border-slate-200 p-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  {isBtConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <BluetoothConnected className="h-3.5 w-3.5" />
                      Terhubung: {printerState.deviceName ?? "Printer Thermal"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <BluetoothOff className="h-3.5 w-3.5" />
                      {printerState.status === "connecting"
                        ? "Menghubungkan Bluetooth..."
                        : "Printer Bluetooth belum terhubung"}
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400">
                    ESC/POS ({paperSize === "58mm" ? "32 kolom" : "48 kolom"})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    disabled={isBtBusy}
                    onClick={handleConnectBluetooth}
                  >
                    <Bluetooth className="mr-1.5 h-3.5 w-3.5" />
                    {isBtConnected ? "Ganti Printer" : "Pilih Printer Bluetooth"}
                  </Button>

                  {isBtConnected && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        disabled={isBtBusy}
                        onClick={handleTestPrintBluetooth}
                      >
                        Test Print
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] text-rose-600 hover:text-rose-700"
                        disabled={isBtBusy}
                        onClick={handleDisconnectBluetooth}
                      >
                        Putuskan
                      </Button>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={handleRawBtPrint}
                    title="Untuk printer thermal Bluetooth Classic (SPP) di perangkat Android via aplikasi RawBT"
                  >
                    <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                    Cetak via RawBT (Android)
                  </Button>
                </div>
              </div>

              {capabilities && !capabilities.isSecureContext && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Web Bluetooth membutuhkan koneksi HTTPS atau localhost. Di perangkat
                  Android, Anda tetap bisa memakai tombol <strong>Cetak via RawBT</strong> atau{" "}
                  <strong>Cetak Browser / PDF</strong>.
                </p>
              )}

              {capabilities?.isIos && !capabilities.webBluetoothSupported && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Catatan iPhone/iPad: Safari iOS belum mendukung Web Bluetooth secara
                  langsung. Gunakan <strong>Cetak Browser / PDF</strong> (AirPrint/printer
                  Wi-Fi) atau buka halaman kasir melalui aplikasi browser{" "}
                  <strong>Bluefy</strong> untuk cetak Bluetooth BLE langsung.
                </p>
              )}

              {capabilities && !capabilities.isIos && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mendukung pairing langsung printer thermal BLE (58mm/80mm) lewat
                  Chrome/Edge, serta fallback <strong>RawBT</strong> untuk printer
                  Android Bluetooth Classic (SPP).
                </p>
              )}
            </div>
          )}
        </div>

        {/* Pilihan Mode Slip Cetak: Struk Harga + Struk Antrean Kitchen */}
        {!kitchenOnly && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <span className="mr-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Bagian Cetak:
            </span>
            <Button
              type="button"
              size="sm"
              variant={printMode === "both" ? "default" : "outline"}
              className="min-h-[44px]"
              onClick={() => updatePrintMode("both")}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Struk Harga + Antrean Kitchen
            </Button>
            <Button
              type="button"
              size="sm"
              variant={printMode === "customer" ? "default" : "outline"}
              className="min-h-[44px]"
              onClick={() => updatePrintMode("customer")}
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Struk Harga Saja
            </Button>
            <Button
              type="button"
              size="sm"
              variant={printMode === "kitchen" ? "default" : "outline"}
              className="min-h-[44px]"
              onClick={() => updatePrintMode("kitchen")}
            >
              <ChefHat className="mr-1.5 h-3.5 w-3.5" />
              Tiket Kitchen Saja
            </Button>
          </div>
        )}
      </div>

      {printerError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 print:hidden">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{printerError}</span>
        </div>
      )}

      {printerSuccess && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 print:hidden">
          {printerSuccess}
        </div>
      )}

      {auditNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 print:hidden">
          {auditNotice}
        </div>
      )}

      {/* Kertas Struk Thermal 58mm / 80mm */}
      <div
        className={`mx-auto rounded-xl border border-zinc-300 bg-white p-4 font-mono text-xs text-zinc-950 shadow-sm print:rounded-none print:border-none print:p-1 print:shadow-none ${
          paperSize === "58mm" ? "w-[220px]" : "w-[302px]"
        }`}
      >
        {/* ================================================================ */}
        {/* BAGIAN 1: STRUK RINCIAN HARGA PELANGGAN / KASIR                  */}
        {/* ================================================================ */}
        {(printMode === "both" || printMode === "customer") && (
          <div>
            {/* Header Outlet */}
            <div className="border-b border-dashed border-zinc-400 pb-2.5 text-center">
              <div className="mx-auto mb-1.5 flex h-14 w-28 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-1621group-stacked.png"
                  alt="Logo 1621 Group"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-sm font-bold uppercase tracking-wide">
                {receipt.outletName}
              </h1>
              {receipt.outletAddress && (
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-700">
                  {receipt.outletAddress}
                </p>
              )}
            </div>

            {/* Metadata Transaksi */}
            <div className="space-y-0.5 border-b border-dashed border-zinc-400 py-2 text-[11px]">
              <div className="flex justify-between">
                <span>No. Order:</span>
                <span className="font-bold">#{receipt.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>
                  {formatDateTimeWIB(receipt.paidAt ?? receipt.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{receipt.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Meja / Tipe:</span>
                <span className="font-bold">
                  {receipt.orderType === "takeaway"
                    ? "Takeaway / Bungkus"
                    : receipt.tableName}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="font-bold uppercase">
                  {receipt.paymentMethod === "qris" ? "QRIS" : "TUNAI"}
                </span>
              </div>
            </div>

            {/* Daftar Item */}
            <div className="space-y-1.5 border-b border-dashed border-zinc-400 py-2.5 text-[11px]">
              {receipt.items.map((item) => (
                <div key={item.id}>
                  <div className="font-semibold">{item.productName}</div>
                  <div className="flex justify-between">
                    <span>
                      {item.qty} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span>{formatRupiah(item.lineTotal)}</span>
                  </div>
                  {item.note && (
                    <div className="italic text-zinc-600">
                      * Catatan: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Rincian Angka */}
            <div className="space-y-1 border-b border-dashed border-zinc-400 py-2 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRupiah(receipt.subtotal)}</span>
              </div>

              {receipt.discount > 0 && (
                <div className="flex justify-between">
                  <span>
                    Diskon
                    {receipt.discountReason
                      ? ` (${receipt.discountReason})`
                      : ""}
                  </span>
                  <span>- {formatRupiah(receipt.discount)}</span>
                </div>
              )}

              {receipt.serviceAmount > 0 && receipt.serviceRate !== null && (
                <div className="flex justify-between">
                  <span>Service ({receipt.serviceRate}%)</span>
                  <span>{formatRupiah(receipt.serviceAmount)}</span>
                </div>
              )}

              {receipt.taxAmount > 0 && receipt.taxRate !== null && (
                <div className="flex justify-between">
                  <span>
                    Pajak ({receipt.taxRate}%
                    {receipt.priceIncludesTax ? " Termasuk" : ""})
                  </span>
                  <span>{formatRupiah(receipt.taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-dashed border-zinc-300 pt-1 text-xs font-bold">
                <span>TOTAL</span>
                <span>{formatRupiah(receipt.total)}</span>
              </div>

              <div className="flex justify-between pt-0.5">
                <span>
                  Bayar ({receipt.paymentMethod === "qris" ? "QRIS" : "Tunai"})
                </span>
                <span>{formatRupiah(receipt.amountReceived)}</span>
              </div>

              <div className="flex justify-between font-semibold">
                <span>Kembali</span>
                <span>{formatRupiah(receipt.changeAmount)}</span>
              </div>
            </div>

            {/* Informasi Pembatalan / Refund jika ada */}
            {receipt.refund && (
              <div className="my-2 border border-zinc-900 p-1.5 text-center text-[10px]">
                <p className="font-bold uppercase">
                  *** DIBATALKAN / REFUND {formatRupiah(receipt.refund.amount)}{" "}
                  ***
                </p>
                <p>Alasan: {receipt.refund.reason}</p>
              </div>
            )}

            {/* Informasi WiFi Pelanggan (jika diatur per outlet) */}
            {(receipt.wifiName || receipt.wifiPassword) && (
              <div className="border-t border-dashed border-zinc-400 pt-2 pb-1 text-center text-[11px]">
                <p className="font-bold uppercase tracking-wide">
                  WiFi Pelanggan
                </p>
                {receipt.wifiName && (
                  <p>
                    SSID: <span className="font-bold">{receipt.wifiName}</span>
                  </p>
                )}
                {receipt.wifiPassword && (
                  <p>
                    Password:{" "}
                    <span className="font-bold">{receipt.wifiPassword}</span>
                  </p>
                )}
              </div>
            )}

            {/* Footer Struk */}
            <div className="pt-2.5 text-center text-[10px] leading-relaxed text-zinc-700">
              <p>
                {receipt.receiptFooter ??
                  "Terima kasih atas kunjungan Anda di 1621 Group!"}
              </p>
            </div>
          </div>
        )}

        {/* GARIS POTONG ANTARA STRUK HARGA & STRUK KITCHEN */}
        {printMode === "both" && (
          <div className="my-4 border-y-2 border-dashed border-zinc-900 py-1.5 text-center text-[10px] font-bold tracking-widest uppercase">
            --- POTONG UNTUK KITCHEN ---
          </div>
        )}

        {/* ================================================================ */}
        {/* BAGIAN 2: STRUK ANTREAN KITCHEN (KITCHEN CHECKER / DOCKET)       */}
        {/* ================================================================ */}
        {(printMode === "both" || printMode === "kitchen") && (
          <div>
            <div className="border-b-2 border-zinc-900 pb-2 text-center">
              <p className="text-[11px] font-extrabold tracking-wider uppercase">
                *** TIKET ANTREAN KITCHEN ***
              </p>
              <p className="text-[10px] font-semibold uppercase text-zinc-700">
                {receipt.outletName}
              </p>
              <div className="mt-1.5 rounded border-2 border-zinc-900 px-2 py-1">
                <p className="text-base font-extrabold uppercase leading-tight">
                  {receipt.orderType === "takeaway"
                    ? "TAKEAWAY / BUNGKUS"
                    : receipt.tableName}
                </p>
                <p className="text-xs font-extrabold">
                  ANTREAN #{receipt.orderNo}
                </p>
              </div>
            </div>

            <div className="space-y-0.5 border-b border-dashed border-zinc-400 py-1.5 text-[10px]">
              <div className="flex justify-between">
                <span>Jam Masuk Kitchen:</span>
                <span className="font-bold">
                  {formatDateTimeWIB(receipt.paidAt ?? receipt.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{receipt.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Porsi:</span>
                <span className="font-bold">{totalQty} item</span>
              </div>
            </div>

            {/* Daftar Menu Produksi Kitchen (Tanpa Harga, Huruf Besar + Kotak Checker) */}
            <div className="space-y-2.5 border-b-2 border-zinc-900 py-2.5">
              {receipt.items.map((item) => (
                <div key={`kitchen-${item.id}`}>
                  <div className="flex items-start justify-between gap-2 text-base font-black leading-snug tracking-tight">
                    <span>
                      [ ] {item.qty}x {item.productName}
                    </span>
                  </div>
                  {item.note && (
                    <div className="mt-1 border-l-2 border-zinc-900 pl-2 text-xs font-bold leading-snug">
                      CATATAN KITCHEN: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 text-center text-[10px] font-bold uppercase">
              <p>CEK KESESUAIAN PESANAN SEBELUM DIANTAR KE MEJA</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
