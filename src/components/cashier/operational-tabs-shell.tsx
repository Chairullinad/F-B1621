"use client";

import * as React from "react";
import {
  ChefHat,
  ClipboardCheck,
  MonitorSmartphone,
  Utensils,
} from "lucide-react";
import { CashierWorkspace } from "@/components/cashier/cashier-workspace";
import { ShiftClosingManager } from "@/components/cashier/shift-closing-manager";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { WaiterBoard } from "@/components/waiter/waiter-board";
import type { CashierWorkspaceData } from "@/server/cashier";
import {
  getShiftClosingWorkspaceData,
  type ShiftClosingWorkspaceData,
} from "@/server/cashier-shift";
import type {
  KitchenWorkspaceData,
  WaiterWorkspaceData,
} from "@/server/kitchen-waiter";

export function OperationalTabsShell({
  cashierData,
  kitchenData,
  waiterData,
  shiftData,
  initialTab = "kasir",
}: {
  cashierData: CashierWorkspaceData;
  kitchenData: KitchenWorkspaceData;
  waiterData: WaiterWorkspaceData;
  shiftData: ShiftClosingWorkspaceData | null;
  initialTab?: "kasir" | "kitchen" | "antar" | "shift";
}) {
  const [activeTab, setActiveTab] = React.useState<
    "kasir" | "kitchen" | "antar" | "shift"
  >(initialTab);
  const [loadedShiftData, setLoadedShiftData] =
    React.useState<ShiftClosingWorkspaceData | null>(shiftData);
  const [isLoadingShift, setIsLoadingShift] = React.useState(false);
  const [livePendingCount, setLivePendingCount] = React.useState(
    cashierData.pendingOrders.length
  );

  React.useEffect(() => {
    setLivePendingCount(cashierData.pendingOrders.length);
  }, [cashierData.pendingOrders.length]);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (shiftData) {
      setLoadedShiftData(shiftData);
    }
  }, [shiftData]);

  React.useEffect(() => {
    if (activeTab !== "shift" || loadedShiftData || isLoadingShift) {
      return;
    }
    let cancelled = false;
    setIsLoadingShift(true);
    void getShiftClosingWorkspaceData()
      .then((data) => {
        if (!cancelled) {
          setLoadedShiftData(data);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingShift(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadedShiftData, isLoadingShift]);

  function handleSelectTab(nextTab: "kasir" | "kitchen" | "antar" | "shift") {
    setActiveTab(nextTab);
    try {
      const nextUrl = nextTab === "kasir" ? "/kasir" : `/kasir?tab=${nextTab}`;
      if (window.location.pathname === "/kasir") {
        window.history.replaceState(null, "", nextUrl);
      }
    } catch {
      // Abaikan jika browser membatasi history API
    }
  }

  const pendingCount = livePendingCount;
  const kitchenCount = kitchenData.paidTickets.length;
  const waiterCount = waiterData.readyTickets.length;

  return (
    <div className="space-y-4">
      {/* Navigasi 4 Tab Operasional Terpadu (Layar Kasir, Layar Kitchen, Layar Antar, Tutupan Shift) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectTab("kasir")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "kasir"
                ? "bg-[#1B5E86] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <MonitorSmartphone className="h-4 w-4" />
            <span>Layar Kasir</span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                activeTab === "kasir"
                  ? "bg-white/20 text-white"
                  : pendingCount > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("kitchen")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "kitchen"
                ? "bg-[#1B5E86] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ChefHat className="h-4 w-4" />
            <span>Layar Kitchen (KDS)</span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                activeTab === "kitchen"
                  ? "bg-white/20 text-white"
                  : kitchenCount > 0
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {kitchenCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("antar")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "antar"
                ? "bg-[#1B5E86] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Utensils className="h-4 w-4" />
            <span>Layar Antar</span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                activeTab === "antar"
                  ? "bg-white/20 text-white"
                  : waiterCount > 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {waiterCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("shift")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "shift"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-950/30"
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span>Tutupan Shift &amp; Cetak Struk</span>
          </button>
        </div>

        <p className="hidden pr-2 text-xs text-slate-500 xl:block">
          Sinkronisasi Real-Time Aktif: Kasir &rarr; Kitchen &rarr; Antar Meja
        </p>
      </div>

      {/* Konten Tab Aktif (CashierWorkspace tetap ter-mount agar WebSocket & alarm order meja tidak putus saat ganti tab) */}
      <CashierWorkspace
        initialData={cashierData}
        isActiveTab={activeTab === "kasir"}
        onSwitchToKasirTab={() => handleSelectTab("kasir")}
        onPendingCountChange={setLivePendingCount}
      />
      {activeTab === "kitchen" && (
        <KitchenBoard
          initialData={kitchenData}
          receiptReturnTo="/kasir?tab=kitchen"
        />
      )}
      {activeTab === "antar" && <WaiterBoard initialData={waiterData} />}
      {activeTab === "shift" &&
        (loadedShiftData ? (
          <ShiftClosingManager initialData={loadedShiftData} />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            Memuat data Tutupan Shift &amp; rekap transaksi hari ini...
          </div>
        ))}
    </div>
  );
}

