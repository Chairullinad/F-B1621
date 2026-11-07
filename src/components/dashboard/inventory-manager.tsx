"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeWIB } from "@/lib/datetime";
import { formatRupiah, roundRupiah } from "@/lib/money";
import {
  createIngredientAction,
  saveProductRecipeAction,
  type InventoryPageData,
} from "@/server/inventory";

export function InventoryManager({
  initialData,
}: {
  initialData: InventoryPageData;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<
    "stock" | "recipes" | "movements"
  >("stock");
  const [isPending, startTransition] = React.useTransition();

  // Form tambah bahan baku
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("Sayur & Bumbu");
  const [unit, setUnit] = React.useState<
    "kg" | "gram" | "liter" | "ml" | "pcs" | "porsi"
  >("kg");
  const [currentStock, setCurrentStock] = React.useState("10");
  const [minStock, setMinStock] = React.useState("5");
  const [unitCost, setUnitCost] = React.useState("25000");

  // Editor Resep (BOM)
  const [selectedProductId, setSelectedProductId] = React.useState<string>(
    initialData.products[0]?.id ?? ""
  );
  const [recipeDraft, setRecipeDraft] = React.useState<
    Array<{ ingredientId: string; qtyPerPortion: string }>
  >([]);

  React.useEffect(() => {
    if (!selectedProductId) return;
    const existing = initialData.recipes
      .filter((r) => r.product_id === selectedProductId)
      .map((r) => ({
        ingredientId: r.ingredient_id,
        qtyPerPortion: String(r.qty_per_portion),
      }));
    setRecipeDraft(existing);
  }, [selectedProductId, initialData.recipes]);

  const lowStockItems = initialData.ingredients.filter(
    (i) => i.current_stock <= i.min_stock
  );
  const totalInventoryValue = initialData.ingredients.reduce(
    (sum, i) => sum + roundRupiah(i.current_stock * i.unit_cost),
    0
  );

  function handleCreateIngredient(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createIngredientAction({
        name,
        category,
        unit,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
        unitCost: parseInt(unitCost, 10) || 0,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setName("");
      router.refresh();
    });
  }

  function handleAddRecipeRow() {
    const firstIng = initialData.ingredients[0];
    if (!firstIng) return;
    setRecipeDraft((prev) => [
      ...prev,
      { ingredientId: firstIng.id, qtyPerPortion: "0.1" },
    ]);
  }

  function handleSaveRecipe() {
    if (!selectedProductId) return;
    startTransition(async () => {
      const validItems = recipeDraft
        .map((r) => ({
          ingredientId: r.ingredientId,
          qtyPerPortion: Number(r.qtyPerPortion),
        }))
        .filter((r) => r.ingredientId && r.qtyPerPortion > 0);

      const res = await saveProductRecipeAction({
        productId: selectedProductId,
        items: validItems,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  const selectedProduct = initialData.products.find(
    (p) => p.id === selectedProductId
  );
  const draftCogs = roundRupiah(
    recipeDraft.reduce((sum, row) => {
      const ing = initialData.ingredients.find(
        (i) => i.id === row.ingredientId
      );
      return sum + (Number(row.qtyPerPortion) || 0) * (ing?.unit_cost ?? 0);
    }, 0)
  );

  return (
    <div className="space-y-6">
      {/* Alert Banner Bahan di Bawah Minimum */}
      {lowStockItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-xs">
          <div>
            <strong>
              🚨 {lowStockItems.length} bahan di bawah stok minimum:
            </strong>{" "}
            {lowStockItems
              .map((l) => `${l.name} (${l.current_stock} ${l.unit})`)
              .join(", ")}
          </div>
          <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
            Segera Buat PO / Restock
          </span>
        </div>
      ) : null}

      {/* 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Total Item Bahan Baku
          </div>
          <div className="mt-1 text-3xl font-extrabold text-slate-900">
            {initialData.ingredients.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Aktif terhubung ke resep &amp; gudang
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Item di Bawah Minimum
          </div>
          <div className="mt-1 text-3xl font-extrabold text-red-600">
            {lowStockItems.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Membutuhkan restock segera
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Total Nilai Persediaan
          </div>
          <div className="mt-1 text-2xl font-extrabold text-blue-700">
            {formatRupiah(totalInventoryValue)}
          </div>
          <div className="mt-1 text-xs text-emerald-700">
            Otomatis sinkron ke Neraca (Aset Lancar)
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-slate-200">
        {[
          { id: "stock", label: "📦 Daftar Bahan Baku & Stok" },
          { id: "recipes", label: "🍲 Resep Menu (BOM) & HPP Auto-Deduct" },
          { id: "movements", label: "📜 Kartu Stok (Riwayat Mutasi)" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              setActiveTab(t.id as "stock" | "recipes" | "movements")
            }
            className={`-mb-0.5 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-blue-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "stock" ? (
        <div className="space-y-6">
          {/* Tabel Bahan Baku */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="mb-4 text-base font-bold text-slate-900">
              Daftar Bahan Baku — f&amp;b1621
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                    <th className="px-3 py-2.5">Bahan Baku</th>
                    <th className="px-3 py-2.5">Kategori</th>
                    <th className="px-3 py-2.5">Satuan</th>
                    <th className="px-3 py-2.5 text-right">Stok Total</th>
                    <th className="px-3 py-2.5 text-right">Min.</th>
                    <th className="px-3 py-2.5 text-center">
                      Gudang / Dapur / Bar
                    </th>
                    <th className="px-3 py-2.5 text-right">Harga / Satuan</th>
                    <th className="px-3 py-2.5 text-right">Nilai Stok</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialData.ingredients.map((item) => {
                    const isLow = item.current_stock <= item.min_stock;
                    const isWarn =
                      !isLow && item.current_stock <= item.min_stock * 1.5;
                    const totalVal = roundRupiah(
                      item.current_stock * item.unit_cost
                    );

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {item.category}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                          {item.unit}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-extrabold ${
                            isLow ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {item.current_stock}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-500">
                          {item.min_stock}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-600">
                          G:{item.storage_stock?.gudang ?? 0} | D:
                          {item.storage_stock?.dapur ?? 0} | B:
                          {item.storage_stock?.bar ?? 0}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">
                          {formatRupiah(item.unit_cost)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {formatRupiah(totalVal)}
                        </td>
                        <td className="px-3 py-2.5">
                          {isLow ? (
                            <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                              ⚠️ Restock
                            </span>
                          ) : isWarn ? (
                            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              Aman
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Tambah Bahan Baku Baru */}
          <form
            onSubmit={handleCreateIngredient}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h3 className="mb-3 text-base font-bold text-slate-900">
              ➕ Tambah Bahan Baku Baru
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nama Bahan
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Susu UHT Full Cream"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Kategori
                </label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Bahan Bar & Minuman"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Satuan
                </label>
                <select
                  value={unit}
                  onChange={(e) =>
                    setUnit(
                      e.target.value as
                        | "kg"
                        | "gram"
                        | "liter"
                        | "ml"
                        | "pcs"
                        | "porsi"
                    )
                  }
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="kg">kg</option>
                  <option value="gram">gram</option>
                  <option value="liter">liter</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                  <option value="porsi">porsi</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Stok Awal
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Batas Minimum
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Harga Beli / Satuan (Rp)
                </label>
                <Input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isPending ? "Menyimpan..." : "+ Simpan Bahan Baku"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {activeTab === "recipes" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                🍲 Komposisi Resep Menu (Bill of Materials) &amp; Auto-Deduct
              </h3>
              <p className="text-xs text-slate-500">
                Setiap kali produk ini terjual (status <code>PAID</code>), stok
                bahan baku di bawah ini otomatis terpotong dan HPP dicatat ke
                jurnal akuntansi.
              </p>
            </div>
          </div>

          <div className="mb-4 max-w-md">
            <label className="mb-1 block text-xs font-bold text-slate-700">
              Pilih Produk Menu
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"
            >
              {initialData.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji ?? "🍽️"} {p.name} — Harga Jual{" "}
                  {formatRupiah(p.price)}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-3.5 text-xs sm:text-sm">
                <div>
                  Harga Jual:{" "}
                  <strong className="text-slate-900">
                    {formatRupiah(selectedProduct.price)}
                  </strong>
                </div>
                <div>
                  HPP Resep per Porsi:{" "}
                  <strong className="text-red-600">
                    {formatRupiah(draftCogs)}
                  </strong>
                </div>
                <div>
                  Estimasi Margin Kotor:{" "}
                  <strong className="text-emerald-700">
                    {formatRupiah(selectedProduct.price - draftCogs)} (
                    {selectedProduct.price > 0
                      ? Math.round(
                          ((selectedProduct.price - draftCogs) /
                            selectedProduct.price) *
                            100
                        )
                      : 0}
                    %)
                  </strong>
                </div>
              </div>

              <div className="space-y-2.5">
                {recipeDraft.map((row, idx) => {
                  const ing = initialData.ingredients.find(
                    (i) => i.id === row.ingredientId
                  );
                  const lineCost = roundRupiah(
                    (Number(row.qtyPerPortion) || 0) * (ing?.unit_cost ?? 0)
                  );
                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5"
                    >
                      <select
                        value={row.ingredientId}
                        onChange={(e) => {
                          const next = [...recipeDraft];
                          next[idx] = {
                            ...row,
                            ingredientId: e.target.value,
                          };
                          setRecipeDraft(next);
                        }}
                        className="h-9 min-w-52 rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium"
                      >
                        {initialData.ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({formatRupiah(i.unit_cost)}/{i.unit})
                          </option>
                        ))}
                      </select>

                      <Input
                        type="number"
                        step="0.01"
                        value={row.qtyPerPortion}
                        onChange={(e) => {
                          const next = [...recipeDraft];
                          next[idx] = {
                            ...row,
                            qtyPerPortion: e.target.value,
                          };
                          setRecipeDraft(next);
                        }}
                        className="w-28"
                      />
                      <span className="text-xs font-semibold text-slate-600">
                        {ing?.unit ?? "kg"} / porsi
                      </span>
                      <span className="ml-auto text-xs font-bold text-slate-800">
                        Biaya: {formatRupiah(lineCost)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRecipeDraft((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        Hapus
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddRecipeRow}
                >
                  + Tambah Bahan ke Resep
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={handleSaveRecipe}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isPending ? "Menyimpan..." : "💾 Simpan Resep & Update HPP"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "movements" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-3 text-base font-bold text-slate-900">
            📜 Riwayat Kartu Stok (Auto-Deduct Penjualan, PO, Opname, &amp;
            Waste)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                  <th className="px-3 py-2.5">Waktu</th>
                  <th className="px-3 py-2.5">Bahan</th>
                  <th className="px-3 py-2.5">Tipe Mutasi</th>
                  <th className="px-3 py-2.5 text-right">Perubahan</th>
                  <th className="px-3 py-2.5 text-right">Stok Akhir</th>
                  <th className="px-3 py-2.5 text-right">Nilai Biaya</th>
                  <th className="px-3 py-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialData.movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-slate-400"
                    >
                      Belum ada riwayat mutasi stok.
                    </td>
                  </tr>
                ) : (
                  initialData.movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {formatDateTimeWIB(m.created_at)}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900">
                        {m.ingredient_name}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                          {m.movement_type}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold ${
                          m.qty_delta < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {m.qty_delta > 0 ? `+${m.qty_delta}` : m.qty_delta}{" "}
                        {m.unit}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {m.stock_after} {m.unit}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatRupiah(m.total_cost)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {m.notes ?? m.reference_id ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

