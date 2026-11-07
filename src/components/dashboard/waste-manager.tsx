"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/money";
import { recordWasteAction, type WastePageData } from "@/server/inventory";

export function WasteManager({ initialData }: { initialData: WastePageData }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [ingredientId, setIngredientId] = React.useState(
    initialData.ingredients[0]?.id ?? ""
  );
  const [qty, setQty] = React.useState("0.5");
  const [reason, setReason] = React.useState<
    "Busuk" | "Expired" | "Tumpah" | "Rusak Produksi" | "Lainnya"
  >("Busuk");
  const [notes, setNotes] = React.useState("");

  const totalWaste = initialData.wasteLogs.reduce(
    (s, x) => s + x.cost_amount,
    0
  );
  const wastePercent =
    initialData.totalRevenueMonth > 0
      ? ((totalWaste / initialData.totalRevenueMonth) * 100).toFixed(2)
      : "0.00";

  function handleRecordWaste(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordWasteAction({
        ingredientId,
        qty: Number(qty) || 0,
        reason,
        notes,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Total Kerugian Waste
          </div>
          <div className="mt-1 text-2xl font-extrabold text-red-600">
            {formatRupiah(totalWaste)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Otomatis mengurangi laba di Laba Rugi
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            % dari Penjualan
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">
            {wastePercent}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Target efisiensi waste &lt; 2.0%
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Kategori Paling Sering
          </div>
          <div className="mt-1 text-lg font-extrabold text-slate-900">
            Sayur, Bumbu &amp; Protein
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Berdasarkan {initialData.wasteLogs.length} catatan waste
          </div>
        </div>
      </div>

      {/* Form Catat Waste Baru */}
      <form
        onSubmit={handleRecordWaste}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <h3 className="mb-3 text-base font-bold text-slate-900">
          🗑️ Catat Waste &amp; Spoilage Baru
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Bahan Baku
            </label>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {initialData.ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Stok: {i.current_stock} {i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Kuantitas Terbuang
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Alasan Waste
            </label>
            <select
              value={reason}
              onChange={(e) =>
                setReason(
                  e.target.value as
                    | "Busuk"
                    | "Expired"
                    | "Tumpah"
                    | "Rusak Produksi"
                    | "Lainnya"
                )
              }
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Busuk">Busuk</option>
              <option value="Expired">Expired</option>
              <option value="Tumpah">Tumpah</option>
              <option value="Rusak Produksi">Rusak Produksi</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Catatan Tambahan
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsional"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? "Mencatat..." : "+ Catat Waste & Potong Stok"}
          </Button>
        </div>
      </form>

      {/* Tabel Riwayat Waste */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          📋 Riwayat Waste &amp; Spoilage
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                <th className="px-3 py-2.5">Tanggal</th>
                <th className="px-3 py-2.5">Bahan</th>
                <th className="px-3 py-2.5">Qty</th>
                <th className="px-3 py-2.5">Alasan</th>
                <th className="px-3 py-2.5 text-right">Nilai Kerugian</th>
                <th className="px-3 py-2.5">Dicatat Oleh</th>
                <th className="px-3 py-2.5">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialData.wasteLogs.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-slate-600">{w.waste_date}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-900">
                    {w.ingredient_name_snapshot}
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    {w.qty} {w.unit}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                      {w.reason}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-red-600">
                    {formatRupiah(w.cost_amount)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {w.recorded_by_name}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {w.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

