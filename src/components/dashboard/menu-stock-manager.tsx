"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MenuStockItem, MenuStockPageData } from "@/server/menu-stock";

interface MenuStockManagerProps {
  initialData: MenuStockPageData;
}

export function MenuStockManager({ initialData }: MenuStockManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedOutletId, setSelectedOutletId] = useState(initialData.activeOutletId);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // State Modal Filter (Screenshot 3)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterAvailability, setFilterAvailability] = useState<
    "all" | "Stok Terbatas" | "Stok Tidak Terbatas" | "Stok Habis"
  >("all");
  const [filterStockRange, setFilterStockRange] = useState<
    "all" | "0-10" | "11-50" | "51-100" | ">100"
  >("all");

  // Applied Filter State
  const [appliedFilters, setAppliedFilters] = useState({
    status: "all" as "all" | "active" | "inactive",
    availability: "all" as "all" | "Stok Terbatas" | "Stok Tidak Terbatas" | "Stok Habis",
    stockRange: "all" as "all" | "0-10" | "11-50" | "51-100" | ">100",
  });

  const handleOutletChange = (outletId: string) => {
    setSelectedOutletId(outletId);
    setPage(1);
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("outletId", outletId);
      router.push(url.pathname + url.search);
    });
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      status: filterStatus,
      availability: filterAvailability,
      stockRange: filterStockRange,
    });
    setPage(1);
    setIsFilterModalOpen(false);
  };

  const handleResetFilters = () => {
    setFilterStatus("all");
    setFilterAvailability("all");
    setFilterStockRange("all");
    setAppliedFilters({
      status: "all",
      availability: "all",
      stockRange: "all",
    });
    setPage(1);
    setIsFilterModalOpen(false);
  };

  // Filter items
  const filteredItems = initialData.items.filter((item: MenuStockItem) => {
    // 1. Search filter
    const matchesSearch =
      searchTerm.trim() === "" ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Status Menu filter
    if (appliedFilters.status === "active" && !item.isActive) return false;
    if (appliedFilters.status === "inactive" && item.isActive) return false;

    // 3. Ketersediaan filter
    if (
      appliedFilters.availability !== "all" &&
      item.availability !== appliedFilters.availability
    ) {
      return false;
    }

    // 4. Jumlah Stok filter
    if (appliedFilters.stockRange !== "all") {
      const stock = item.stockCount;
      if (appliedFilters.stockRange === "0-10" && (stock < 0 || stock > 10)) return false;
      if (appliedFilters.stockRange === "11-50" && (stock < 11 || stock > 50)) return false;
      if (appliedFilters.stockRange === "51-100" && (stock < 51 || stock > 100)) return false;
      if (appliedFilters.stockRange === ">100" && stock <= 100) return false;
    }

    return true;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const displayedItems = filteredItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const activeFiltersCount =
    (appliedFilters.status !== "all" ? 1 : 0) +
    (appliedFilters.availability !== "all" ? 1 : 0) +
    (appliedFilters.stockRange !== "all" ? 1 : 0);

  return (
    <div className="space-y-4 bg-[#F4F6F9] -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800">
      {/* 1. Breadcrumb & Header with Outlet Switcher (Persis Screenshot 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-2xs text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-sky-600">
              Dashboard
            </Link>{" "}
            &gt; <span className="text-slate-600">Stok Menu</span>
          </div>
          <h1 className="text-base font-bold text-slate-800 mt-1 tracking-tight">
            Stok Menu
          </h1>
        </div>

        {/* Outlet Switcher Dropdown (Multi-Outlet) */}
        <div className="w-full sm:w-64">
          <select
            value={selectedOutletId}
            disabled={isPending}
            onChange={(e) => handleOutletChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-[#0284C7] focus:outline-hidden cursor-pointer"
          >
            {initialData.availableOutlets.map((out) => (
              <option key={out.id} value={out.id}>
                {out.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Filter Bar & Controls (Persis Screenshot 2) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Tombol Filter */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition shadow-2xs cursor-pointer ${
              activeFiltersCount > 0
                ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>⚡</span>
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-[#0284C7] px-1.5 py-0.2 text-[10px] text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Search Bar with Search Icon on Right (Persis Screenshot 2) */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cari berdasarkan nama menu atau kategori"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3.5 pr-9 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
          </div>
        </div>

        {/* Notice Callout (Persis Screenshot 2) */}
        <div className="flex items-center gap-2 rounded-lg bg-rose-50/70 border border-rose-100 p-2.5 text-2xs text-rose-800">
          <span className="text-sm">⚠️</span>
          <span>
            Stok Menu terintegrasi langsung dengan Aplikasi Kasir &amp; Pengurangan Otomatis Bahan Baku (BOM).
          </span>
        </div>

        {/* 3. Tabel Stok Menu (Persis Screenshot 2) */}
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-sky-50/50 text-slate-600 font-semibold border-b border-slate-200/70">
              <tr>
                <th className="py-2.5 px-3 w-12">No.</th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span>Menu</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span>Kategori</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span>Status</span>
                    <span className="text-2xs text-sky-500 font-bold">🛈</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span>Ketersediaan</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer">
                    <span>Jumlah Stok</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Tidak ada menu yang sesuai dengan filter atau pencarian.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const rowNum = (page - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {rowNum}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {item.categoryName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-2xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                          {item.isActive ? "Aktif" : "Tidak Aktif"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-2xs font-medium px-2 py-0.5 rounded ${
                            item.availability === "Stok Habis"
                              ? "bg-rose-50 text-rose-700 font-bold"
                              : item.availability === "Stok Terbatas"
                              ? "bg-amber-50 text-amber-700 font-bold"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {item.availability}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        {item.stockCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pagination (Persis Screenshot 2) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-2xs text-slate-500 pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 cursor-pointer"
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
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
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 cursor-pointer"
            >
              &gt;
            </button>
          </div>
          <div>
            Menampilkan {displayedItems.length} dari {filteredItems.length} data
          </div>
        </div>
      </div>

      {/* 5. Modal Filter Pop-up Interaktif (Persis Screenshot 3) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Filters</h3>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter Section 1: Status Menu */}
            <div className="space-y-2">
              <label className="block text-2xs font-semibold text-slate-500">
                Status Menu
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus(filterStatus === "active" ? "all" : "active")
                  }
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    filterStatus === "active"
                      ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus(filterStatus === "inactive" ? "all" : "inactive")
                  }
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    filterStatus === "inactive"
                      ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Tidak Aktif
                </button>
              </div>
            </div>

            {/* Filter Section 2: Ketersediaan */}
            <div className="space-y-2">
              <label className="block text-2xs font-semibold text-slate-500">
                Ketersediaan
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFilterAvailability(
                      filterAvailability === "Stok Terbatas" ? "all" : "Stok Terbatas"
                    )
                  }
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    filterAvailability === "Stok Terbatas"
                      ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Stok Terbatas
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterAvailability(
                      filterAvailability === "Stok Tidak Terbatas"
                        ? "all"
                        : "Stok Tidak Terbatas"
                    )
                  }
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    filterAvailability === "Stok Tidak Terbatas"
                      ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Stok Tidak Terbatas
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterAvailability(
                      filterAvailability === "Stok Habis" ? "all" : "Stok Habis"
                    )
                  }
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                    filterAvailability === "Stok Habis"
                      ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Stok Habis
                </button>
              </div>
            </div>

            {/* Filter Section 3: Jumlah Stok */}
            <div className="space-y-2">
              <label className="block text-2xs font-semibold text-slate-500">
                Jumlah Stok
              </label>
              <div className="flex flex-wrap gap-2">
                {(["0-10", "11-50", "51-100", ">100"] as const).map((rng) => (
                  <button
                    key={rng}
                    type="button"
                    onClick={() =>
                      setFilterStockRange(filterStockRange === rng ? "all" : rng)
                    }
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                      filterStockRange === rng
                        ? "border-[#0284C7] bg-sky-50 text-[#0284C7]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {rng}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions (Reset & Terapkan Oranye Khas ESB) */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="w-full rounded-lg bg-[#F58220] py-2.5 text-xs font-bold text-white hover:bg-[#e07519] transition shadow-xs cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
