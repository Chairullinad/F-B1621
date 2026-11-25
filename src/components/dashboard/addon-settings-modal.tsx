"use client";

import * as React from "react";
import { Check, Layers, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ProductAddonGroupWithOptions } from "@/lib/addons";
import { formatRupiah } from "@/lib/money";
import type {
  CategoryRow,
  ProductAddonAssignmentRow,
  ProductRow,
} from "@/lib/types/database";
import {
  deleteAddonGroupAction,
  saveAddonGroupAction,
  setAddonGroupProductsAction,
} from "@/server/product-addons";

interface OptionDraft {
  id?: string;
  name: string;
  priceDeltaStr: string;
  isAvailable: boolean;
}

interface AddonSettingsModalProps {
  open: boolean;
  onClose: () => void;
  schemaReady: boolean;
  groups: ReadonlyArray<ProductAddonGroupWithOptions>;
  assignments: ReadonlyArray<ProductAddonAssignmentRow>;
  products: ReadonlyArray<ProductRow>;
  categories: ReadonlyArray<CategoryRow>;
  onUpdated: () => void;
}

export function AddonSettingsModal({
  open,
  onClose,
  schemaReady,
  groups,
  assignments,
  products,
  categories,
  onUpdated,
}: AddonSettingsModalProps) {
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | "NEW">(
    () => groups[0]?.id ?? "NEW"
  );
  const [activeSubTab, setActiveSubTab] = React.useState<"config" | "menus">("config");
  const [isPending, startTransition] = React.useTransition();

  // Form state grup
  const [groupName, setGroupName] = React.useState("");
  const [selectionType, setSelectionType] = React.useState<"single" | "multiple">("single");
  const [isRequired, setIsRequired] = React.useState(false);
  const [maxSelectStr, setMaxSelectStr] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [optionsDraft, setOptionsDraft] = React.useState<OptionDraft[]>([
    { name: "", priceDeltaStr: "0", isAvailable: true },
  ]);

  // Checklist menu state
  const [assignedProductIds, setAssignedProductIds] = React.useState<Set<string>>(
    new Set()
  );
  const [menuSearch, setMenuSearch] = React.useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = React.useState("ALL");

  const hydrateFromGroup = React.useCallback(
    (targetId: string | "NEW") => {
      if (targetId === "NEW") {
        setGroupName("");
        setSelectionType("single");
        setIsRequired(false);
        setMaxSelectStr("");
        setIsActive(true);
        setOptionsDraft([{ name: "", priceDeltaStr: "0", isAvailable: true }]);
        setAssignedProductIds(new Set());
        return;
      }

      const grp = groups.find((g) => g.id === targetId);
      if (!grp) return;

      setGroupName(grp.name);
      setSelectionType(grp.selectionType);
      setIsRequired(grp.isRequired);
      setMaxSelectStr(grp.maxSelect ? String(grp.maxSelect) : "");
      setIsActive(grp.isActive);
      setOptionsDraft(
        grp.options.length > 0
          ? grp.options.map((o) => ({
              id: o.id,
              name: o.name,
              priceDeltaStr: String(o.priceDelta),
              isAvailable: o.isAvailable,
            }))
          : [{ name: "", priceDeltaStr: "0", isAvailable: true }]
      );

      const matched = new Set(
        assignments
          .filter((a) => a.addon_group_id === grp.id)
          .map((a) => a.product_id)
      );
      setAssignedProductIds(matched);
    },
    [groups, assignments]
  );

  React.useEffect(() => {
    if (!open) return;
    if (selectedGroupId !== "NEW" && !groups.some((g) => g.id === selectedGroupId)) {
      const nextId = groups[0]?.id ?? "NEW";
      setSelectedGroupId(nextId);
      hydrateFromGroup(nextId);
    } else {
      hydrateFromGroup(selectedGroupId);
    }
  }, [open, groups, selectedGroupId, hydrateFromGroup]);

  const assignmentCountByGroup = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      map.set(a.addon_group_id, (map.get(a.addon_group_id) ?? 0) + 1);
    }
    return map;
  }, [assignments]);

  const categoryNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const filteredProducts = React.useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (menuCategoryFilter !== "ALL" && p.category_id !== menuCategoryFilter) {
        return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [products, menuSearch, menuCategoryFilter]);

  if (!open) return null;

  function handleSelectGroup(id: string | "NEW", tab: "config" | "menus" = activeSubTab) {
    setSelectedGroupId(id);
    setActiveSubTab(id === "NEW" ? "config" : tab);
    hydrateFromGroup(id);
  }

  function handleAddOptionRow() {
    setOptionsDraft((prev) => [
      ...prev,
      { name: "", priceDeltaStr: "0", isAvailable: true },
    ]);
  }

  function handleRemoveOptionRow(idx: number) {
    setOptionsDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!schemaReady) {
      toast.error(
        "Tabel add-on belum dimigrasi ke Supabase. Jalankan migrasi 20261107000011_product_addons.sql terlebih dahulu."
      );
      return;
    }

    const parsedOptions = optionsDraft.map((o) => ({
      id: o.id,
      name: o.name.trim(),
      priceDelta: Math.max(0, Number.parseInt(o.priceDeltaStr || "0", 10) || 0),
      isAvailable: o.isAvailable,
    }));

    if (parsedOptions.some((o) => !o.name)) {
      toast.error("Semua baris opsi add-on wajib memiliki nama.");
      return;
    }

    const parsedMaxSelect =
      selectionType === "multiple" && maxSelectStr.trim()
        ? Number.parseInt(maxSelectStr, 10)
        : null;

    startTransition(async () => {
      const res = await saveAddonGroupAction({
        id: selectedGroupId === "NEW" ? undefined : selectedGroupId,
        name: groupName.trim(),
        selectionType,
        isRequired,
        maxSelect:
          parsedMaxSelect && Number.isInteger(parsedMaxSelect) && parsedMaxSelect >= 1
            ? parsedMaxSelect
            : null,
        isActive,
        options: parsedOptions,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      if (res.groupId) {
        setSelectedGroupId(res.groupId);
      }
      onUpdated();
    });
  }

  function handleDeleteGroup(groupId: string) {
    startTransition(async () => {
      const res = await deleteAddonGroupAction({ id: groupId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSelectedGroupId("NEW");
      setActiveSubTab("config");
      onUpdated();
    });
  }

  function handleToggleProductCheck(productId: string) {
    setAssignedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function handleSelectAllVisibleProducts(checked: boolean) {
    setAssignedProductIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredProducts) {
        if (checked) {
          next.add(p.id);
        } else {
          next.delete(p.id);
        }
      }
      return next;
    });
  }

  function handleSaveMenuAssignments() {
    if (selectedGroupId === "NEW") return;
    startTransition(async () => {
      const res = await setAddonGroupProductsAction({
        addonGroupId: selectedGroupId,
        productIds: Array.from(assignedProductIds),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      onUpdated();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <SlidersHorizontal className="h-4 w-4 text-[#1E88E5]" />
              <span>Kelola Add-On, Level &amp; Topping Menu</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Buat grup pilihan (Level Kepedasan, Level Gula, Topping) lalu atur menu mana saja yang memakainya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal add-on"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!schemaReady && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs font-medium text-amber-900">
            Tabel database add-on belum ditemukan. Jalankan migrasi{" "}
            <code className="font-mono font-bold">
              supabase/migrations/20261107000011_product_addons.sql
            </code>{" "}
            di Supabase terlebih dahulu sebelum menyimpan pengaturan add-on.
          </div>
        )}

        {/* Body 2 Panel */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Panel Kiri: Daftar Grup Add-On */}
          <div className="border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 md:col-span-4 overflow-y-auto space-y-2.5">
            <button
              type="button"
              onClick={() => handleSelectGroup("NEW", "config")}
              className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedGroupId === "NEW"
                  ? "bg-[#1E88E5] text-white shadow-xs"
                  : "border border-dashed border-[#1E88E5]/50 bg-white dark:bg-slate-900 text-[#1E88E5] hover:bg-[#EBF5FF]"
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Grup Add-On Baru</span>
            </button>

            <div className="space-y-1.5 pt-1">
              {groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center text-xs text-slate-400">
                  Belum ada grup add-on. Contoh: Level Kepedasan, Level Gula, Tambahan Topping.
                </p>
              ) : (
                groups.map((grp) => {
                  const isSelected = selectedGroupId === grp.id;
                  const menuCount = assignmentCountByGroup.get(grp.id) ?? 0;
                  return (
                    <div
                      key={grp.id}
                      onClick={() => handleSelectGroup(grp.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectGroup(grp.id);
                        }
                      }}
                      className={`rounded-xl border p-3 transition cursor-pointer ${
                        isSelected
                          ? "border-[#1E88E5] bg-[#EBF5FF]/80 dark:bg-sky-950/40 shadow-2xs"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                            {grp.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {grp.selectionType === "single" ? "Pilih 1" : "Pilih Banyak"} &bull;{" "}
                            {grp.isRequired ? "Wajib" : "Opsional"} &bull;{" "}
                            {grp.options.length} opsi
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {menuCount} menu
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel Kanan: Form Konfigurasi Grup ATAU Checklist Menu */}
          <div className="flex min-h-0 flex-col md:col-span-8 overflow-hidden">
            {selectedGroupId !== "NEW" && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-5 py-2.5 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("config")}
                    className={`h-9 rounded-lg px-3 text-xs font-bold transition cursor-pointer ${
                      activeSubTab === "config"
                        ? "bg-[#1E88E5] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                    }`}
                  >
                    1. Pengaturan &amp; Opsi
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("menus")}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition cursor-pointer ${
                      activeSubTab === "menus"
                        ? "bg-[#1E88E5] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>2. Terapkan ke Menu ({assignedProductIds.size})</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteGroup(selectedGroupId)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus Grup</span>
                </button>
              </div>
            )}

            {activeSubTab === "config" || selectedGroupId === "NEW" ? (
              <form
                onSubmit={handleSaveGroup}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Nama Grup Add-On *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Level Kepedasan, Level Gula, Tambahan Topping"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm outline-hidden focus:border-[#1E88E5]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Tipe Pemilihan
                      </label>
                      <select
                        value={selectionType}
                        onChange={(e) =>
                          setSelectionType(
                            e.target.value === "multiple" ? "multiple" : "single"
                          )
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm outline-hidden focus:border-[#1E88E5]"
                      >
                        <option value="single">Pilih 1 Saja (Contoh: Level Pedas / Gula)</option>
                        <option value="multiple">Boleh Pilih Banyak (Contoh: Topping)</option>
                      </select>
                    </div>

                    {selectionType === "multiple" ? (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Batas Maksimal Pilih (Opsional)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          placeholder="Kosongkan jika bebas"
                          value={maxSelectStr}
                          onChange={(e) => setMaxSelectStr(e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm outline-hidden focus:border-[#1E88E5]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-end pb-2">
                        <p className="text-xs text-slate-500">
                          Pelanggan hanya bisa memilih tepat 1 opsi dari grup ini.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-2.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        onChange={(e) => setIsRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1E88E5]"
                      />
                      <span>Wajib Dipilih Pelanggan</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1E88E5]"
                      />
                      <span>Grup Aktif</span>
                    </label>
                  </div>

                  {/* Daftar Pilihan Opsi */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Daftar Pilihan Opsi &amp; Tambahan Harga
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Isi `0` bila gratis (contoh level pedas/gula), atau nominal Rupiah tambahan untuk topping.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddOptionRow}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-sky-200 bg-[#EBF5FF] px-3 text-xs font-bold text-[#1E88E5] hover:bg-sky-100 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah Opsi</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {optionsDraft.map((opt, idx) => (
                        <div
                          key={opt.id ?? `new-${idx}`}
                          className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
                        >
                          <input
                            type="text"
                            required
                            placeholder="Nama opsi (cth: Pedas Sedang / Extra Keju)"
                            value={opt.name}
                            onChange={(e) =>
                              setOptionsDraft((prev) =>
                                prev.map((row, rIdx) =>
                                  rIdx === idx ? { ...row, name: e.target.value } : row
                                )
                              )
                            }
                            className="h-9 min-w-[160px] flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 px-3 text-xs font-medium outline-hidden focus:border-[#1E88E5] focus:bg-white"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-400">+Rp</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={opt.priceDeltaStr}
                              onChange={(e) =>
                                setOptionsDraft((prev) =>
                                  prev.map((row, rIdx) =>
                                    rIdx === idx
                                      ? { ...row, priceDeltaStr: e.target.value }
                                      : row
                                  )
                                )
                              }
                              className="h-9 w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 px-2.5 text-xs font-bold text-right outline-hidden focus:border-[#1E88E5] focus:bg-white"
                            />
                          </div>
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-1">
                            <input
                              type="checkbox"
                              checked={opt.isAvailable}
                              onChange={(e) =>
                                setOptionsDraft((prev) =>
                                  prev.map((row, rIdx) =>
                                    rIdx === idx
                                      ? { ...row, isAvailable: e.target.checked }
                                      : row
                                  )
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-[#1E88E5]"
                            />
                            <span>Tersedia</span>
                          </label>
                          <button
                            type="button"
                            disabled={optionsDraft.length <= 1}
                            onClick={() => handleRemoveOptionRow(idx)}
                            aria-label="Hapus baris opsi"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-35 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/60 dark:bg-slate-950/40">
                  <p className="text-[11px] text-slate-500">
                    {selectedGroupId === "NEW"
                      ? "Setelah disimpan, lanjut pilih menu mana saja di tab 2."
                      : "Perubahan add-on otomatis berlaku ke menu yang terpasang."}
                  </p>
                  <button
                    type="submit"
                    disabled={isPending || !schemaReady}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E88E5] px-4 text-xs font-bold text-white hover:bg-[#1976D2] disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isPending ? "Menyimpan..." : "Simpan Grup Add-On"}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: PILIH MENU MANA SAJA YANG PAKAI ADD-ON INI */
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Centang menu yang memakai <strong>{groupName}</strong>. Menu yang tidak dicentang tidak akan memunculkan add-on ini.
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectAllVisibleProducts(true)}
                        className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        Pilih Semua Tampil
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllVisibleProducts(false)}
                        className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari menu..."
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 text-xs outline-hidden focus:border-[#1E88E5] focus:bg-white"
                      />
                    </div>
                    <select
                      value={menuCategoryFilter}
                      onChange={(e) => setMenuCategoryFilter(e.target.value)}
                      className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold outline-hidden focus:border-[#1E88E5]"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filteredProducts.map((prod) => {
                      const checked = assignedProductIds.has(prod.id);
                      return (
                        <label
                          key={prod.id}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 transition cursor-pointer ${
                            checked
                              ? "border-[#1E88E5] bg-[#EBF5FF]/70 dark:bg-sky-950/40"
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleProductCheck(prod.id)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#1E88E5]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                              {prod.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {categoryNameMap.get(prod.category_id) ?? "Menu"} &bull;{" "}
                              {formatRupiah(prod.price)}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/60 dark:bg-slate-950/40">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {assignedProductIds.size} dari {products.length} menu dipilih
                  </span>
                  <button
                    type="button"
                    disabled={isPending || !schemaReady}
                    onClick={handleSaveMenuAssignments}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E88E5] px-4 text-xs font-bold text-white hover:bg-[#1976D2] disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isPending ? "Menyimpan..." : "Simpan Penetapan Menu"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
