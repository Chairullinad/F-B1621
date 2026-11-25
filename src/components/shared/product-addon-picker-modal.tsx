"use client";

import * as React from "react";
import {
  Check,
  MessageSquareText,
  Minus,
  Plus,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateUnitPriceWithAddons,
  validateAndResolveSelectedAddons,
  type ProductAddonGroupWithOptions,
} from "@/lib/addons";
import { formatRupiah } from "@/lib/money";
import type { OrderItemAddonSnapshot, ProductRow } from "@/lib/types/database";

interface ProductAddonPickerModalProps {
  product: ProductRow | null;
  categoryName?: string;
  groups: ReadonlyArray<ProductAddonGroupWithOptions>;
  initialSelectedOptionIds?: ReadonlyArray<string>;
  initialQty?: number;
  initialNote?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (payload: {
    product: ProductRow;
    selectedOptionIds: string[];
    selectedAddons: OrderItemAddonSnapshot[];
    unitPrice: number;
    qty: number;
    note: string;
  }) => void;
}

export function ProductAddonPickerModal({
  product,
  categoryName,
  groups,
  initialSelectedOptionIds,
  initialQty = 1,
  initialNote = "",
  confirmLabel = "Tambah ke Keranjang",
  onClose,
  onConfirm,
}: ProductAddonPickerModalProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() => [
    ...(initialSelectedOptionIds ?? []),
  ]);
  const [qty, setQty] = React.useState<number>(Math.max(1, initialQty));
  const [note, setNote] = React.useState<string>(initialNote);

  React.useEffect(() => {
    if (!product) return;
    setSelectedIds([...(initialSelectedOptionIds ?? [])]);
    setQty(Math.max(1, initialQty));
    setNote(initialNote);
  }, [product, initialSelectedOptionIds, initialQty, initialNote]);

  React.useEffect(() => {
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [product, onClose]);

  const optionIdsByGroup = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const grp of groups) {
      map.set(grp.id, new Set(grp.options.map((o) => o.id)));
    }
    return map;
  }, [groups]);

  const selectedCountByGroup = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const grp of groups) {
      const set = optionIdsByGroup.get(grp.id);
      if (!set) continue;
      let count = 0;
      for (const id of selectedIds) {
        if (set.has(id)) count += 1;
      }
      counts.set(grp.id, count);
    }
    return counts;
  }, [groups, optionIdsByGroup, selectedIds]);

  const previewValidation = React.useMemo(
    () =>
      validateAndResolveSelectedAddons({
        assignedGroups: groups,
        selectedOptionIds: selectedIds,
      }),
    [groups, selectedIds]
  );

  if (!product) return null;

  const unitPrice = previewValidation.ok
    ? calculateUnitPriceWithAddons(product.price, previewValidation.selectedAddons)
    : product.price;
  const lineTotalPreview = unitPrice * qty;

  function handleSelectOption(
    group: ProductAddonGroupWithOptions,
    optionId: string,
    isAvailable: boolean
  ) {
    if (!isAvailable) return;

    const groupOptionSet = optionIdsByGroup.get(group.id) ?? new Set<string>();
    if (group.selectionType === "single") {
      setSelectedIds((prev) => {
        const filtered = prev.filter((id) => !groupOptionSet.has(id));
        if (prev.includes(optionId) && !group.isRequired) {
          return filtered;
        }
        return [...filtered, optionId];
      });
      return;
    }

    // Multiple selection
    setSelectedIds((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      }
      const currentInGroup = prev.filter((id) => groupOptionSet.has(id)).length;
      if (group.maxSelect !== null && currentInGroup >= group.maxSelect) {
        toast.error(
          `Maksimal ${group.maxSelect} pilihan pada "${group.name}".`
        );
        return prev;
      }
      return [...prev, optionId];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    if (!previewValidation.ok) {
      toast.error(previewValidation.message);
      return;
    }

    onConfirm({
      product,
      selectedOptionIds: [...selectedIds].sort(),
      selectedAddons: previewValidation.selectedAddons,
      unitPrice,
      qty,
      note: note.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-150"
      >
        {/* Header Item */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
              {product.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UtensilsCrossed className="h-6 w-6 text-[#1E88E5]" />
              )}
            </div>
            <div className="min-w-0">
              {categoryName && (
                <p className="text-[11px] font-semibold text-[#1E88E5]">
                  {categoryName}
                </p>
              )}
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                {product.name}
              </h3>
              <p className="mt-0.5 text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {formatRupiah(product.price)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pilihan menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Pilihan Add-On & Catatan */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {groups.map((grp) => {
            const availableOpts = grp.options.filter((o) => o.isAvailable);
            const selectedCount = selectedCountByGroup.get(grp.id) ?? 0;
            const needsSelection =
              grp.isRequired && availableOpts.length > 0 && selectedCount === 0;

            return (
              <div key={grp.id} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {grp.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {grp.selectionType === "single"
                        ? "Pilih 1 opsi"
                        : grp.maxSelect
                          ? `Pilih maksimal ${grp.maxSelect} opsi`
                          : "Boleh pilih lebih dari 1"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      needsSelection
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : grp.isRequired
                          ? "bg-[#EBF5FF] text-[#1E88E5]"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {grp.isRequired ? "Wajib" : "Opsional"}
                  </span>
                </div>

                <div className="space-y-2">
                  {grp.options.map((opt) => {
                    const checked = selectedIds.includes(opt.id);
                    const disabled = !opt.isAvailable;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          handleSelectOption(grp, opt.id, opt.isAvailable)
                        }
                        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                          disabled
                            ? "border-slate-200/70 bg-slate-50 opacity-50 cursor-not-allowed"
                            : checked
                              ? "border-[#1E88E5] bg-[#EBF5FF]/80 dark:bg-sky-950/50 cursor-pointer"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-slate-300 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition ${
                              grp.selectionType === "single"
                                ? "rounded-full"
                                : "rounded-md"
                            } ${
                              checked
                                ? "border-[#1E88E5] bg-[#1E88E5] text-white"
                                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {opt.name}
                          </span>
                        </div>

                        <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
                          {disabled
                            ? "Habis"
                            : opt.priceDelta > 0
                              ? `+ ${formatRupiah(opt.priceDelta)}`
                              : "Gratis"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Catatan Dapur Opsional */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
              Catatan Dapur (Opsional)
            </label>
            <div className="relative">
              <MessageSquareText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                maxLength={160}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Misal: tanpa daun bawang, es sedikit, kuah dipisah"
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#1E88E5] focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Qty & Submit */}
        <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 sm:px-5">
          <div className="inline-flex h-12 items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5">
            <button
              type="button"
              onClick={() => setQty((prev) => Math.max(1, prev - 1))}
              aria-label="Kurangi jumlah"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 active:scale-95 cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-8 text-center text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((prev) => Math.min(50, prev + 1))}
              aria-label="Tambah jumlah"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#1E88E5] hover:bg-white dark:hover:bg-slate-700 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="submit"
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold text-white shadow-md transition cursor-pointer ${
              previewValidation.ok
                ? "bg-[#1E88E5] hover:bg-[#1976D2] active:scale-[0.99]"
                : "bg-slate-400 hover:bg-slate-500"
            }`}
          >
            <span>{confirmLabel}</span>
            <span className="tabular-nums">&bull; {formatRupiah(lineTotalPreview)}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
