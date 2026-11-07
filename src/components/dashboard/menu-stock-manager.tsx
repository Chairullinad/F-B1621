"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import type { CategoryRow, ProductRow } from "@/lib/types/database";
import { toggleProductAvailabilityAction } from "@/server/master-data";

interface MenuStockManagerProps {
  initialProducts: ProductRow[];
  categories: CategoryRow[];
  outletName: string;
}

export function MenuStockManager({
  initialProducts,
  categories,
  outletName,
}: MenuStockManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);

  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.id, c.name);
  }

  // Filter products by search and category
  const filtered = products.filter((p) => {
    const matchesSearch =
      searchTerm.trim() === "" ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (categoryMap.get(p.category_id) ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || p.category_id === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const displayed = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleToggle = (prod: ProductRow) => {
    startTransition(async () => {
      const res = await toggleProductAvailabilityAction({
        id: prod.id,
        isAvailable: !prod.is_available,
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((item) =>
            item.id === prod.id ? { ...item, is_available: !item.is_available } : item
          )
        );
      }
    });
  };

  return (
    <div className="space-y-4 bg-[#F4F6F9] -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800">
      {/* Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-2xs text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-sky-600">
              Dashboard
            </Link>{" "}
            &gt; <span className="text-slate-600">Stok Menu</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800 mt-1">Stok Menu</h1>
        </div>
        <div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs">
            {outletName}
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Dropdown Kategori */}
          <div className="w-full sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#0284C7] focus:outline-hidden"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Cari berdasarkan nama menu atau kategori..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Warning Callout Sesuai Screenshot ESB */}
        <div className="flex items-center gap-2 rounded-lg bg-amber-50/80 border border-amber-200/80 px-3 py-2 text-2xs text-amber-900">
          <span className="text-sm">⚠️</span>
          <span>
            Ketersediaan menu dapat diubah langsung di tabel ini atau otomatis tersinkronisasi dengan kalkulator Bahan Baku / BOM.
          </span>
        </div>

        {/* Tabel Menu */}
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-sky-50/50 text-slate-600 font-semibold border-b border-slate-200/70">
              <tr>
                <th className="py-2.5 px-3 w-12">No.</th>
                <th className="py-2.5 px-3">Menu</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Ketersediaan</th>
                <th className="py-2.5 px-3 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Tidak ada menu yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                displayed.map((p, idx) => {
                  const rowNum = (page - 1) * itemsPerPage + idx + 1;
                  const catName = categoryMap.get(p.category_id) ?? "Umum";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {rowNum}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {catName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-2xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                          Aktif
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {p.is_available ? (
                          <span className="text-2xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Stok Tidak Terbatas / Tersedia
                          </span>
                        ) : (
                          <span className="text-2xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            Habis (Sold Out)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleToggle(p)}
                          className={`rounded px-3 py-1 text-2xs font-bold transition ${
                            p.is_available
                              ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          }`}
                        >
                          {p.is_available ? "Set Habis" : "Set Tersedia"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-2xs text-slate-500 pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`rounded px-2.5 py-1 font-semibold ${
                    page === p
                      ? "bg-[#0284C7] text-white"
                      : "border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            {totalPages > 5 && <span className="px-1 text-slate-400">...</span>}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
          <div>
            Menampilkan {displayed.length} dari {filtered.length} data
          </div>
        </div>
      </div>
    </div>
  );
}
