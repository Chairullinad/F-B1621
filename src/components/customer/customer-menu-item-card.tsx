"use client";

import * as React from "react";
import { Coffee, CupSoda, Minus, Plus, Soup, UtensilsCrossed } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import type { ProductRow } from "@/lib/types/database";

interface CustomerMenuItemCardProps {
  product: ProductRow;
  categoryName: string;
  hasAddons: boolean;
  totalQtyInCart: number;
  onQuickAdd: (product: ProductRow) => void;
  onOpenOptions: (product: ProductRow) => void;
  onChangeSingleVariantQty: (productId: string, delta: number) => void;
}

function renderFallbackMenuIcon(productName: string, categoryName: string) {
  const haystack = `${productName} ${categoryName}`.toLowerCase();
  if (
    haystack.includes("kopi") ||
    haystack.includes("latte") ||
    haystack.includes("coffee")
  ) {
    return <Coffee className="h-10 w-10 text-amber-700/80" />;
  }
  if (
    haystack.includes("minum") ||
    haystack.includes("teh") ||
    haystack.includes("es ") ||
    haystack.includes("jus")
  ) {
    return <CupSoda className="h-10 w-10 text-[#1E88E5]/85" />;
  }
  if (
    haystack.includes("ramen") ||
    haystack.includes("mie") ||
    haystack.includes("kuah") ||
    haystack.includes("sup")
  ) {
    return <Soup className="h-10 w-10 text-orange-600/80" />;
  }
  return <UtensilsCrossed className="h-10 w-10 text-[#1E88E5]/80" />;
}

export function CustomerMenuItemCard({
  product,
  categoryName,
  hasAddons,
  totalQtyInCart,
  onQuickAdd,
  onOpenOptions,
  onChangeSingleVariantQty,
}: CustomerMenuItemCardProps) {
  const isOut = !product.is_available;

  return (
    <div
      className={`group flex flex-col justify-between rounded-[24px] border bg-white p-3 transition-all ${
        isOut
          ? "border-slate-200/80 bg-slate-50/80 opacity-65"
          : totalQtyInCart > 0
            ? "border-[#1E88E5]/55 bg-[#F7FBFF] shadow-[0_6px_18px_rgba(30,136,229,0.12)]"
            : "border-slate-100 shadow-[0_3px_14px_rgba(15,23,42,0.04)] hover:border-sky-200 hover:shadow-md"
      }`}
    >
      {/* Area Foto + Klik Buka Detail/Add-On */}
      <button
        type="button"
        disabled={isOut}
        onClick={() => onOpenOptions(product)}
        className="w-full text-left cursor-pointer disabled:cursor-not-allowed focus:outline-none"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#EEF5FC] via-slate-50 to-slate-100 flex items-center justify-center">
          {product.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            renderFallbackMenuIcon(product.name, categoryName)
          )}

          {/* Badge Qty di Keranjang atau Indikator Add-On */}
          {!isOut && totalQtyInCart > 0 ? (
            <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1E88E5] px-2 text-[11px] font-extrabold text-white shadow-sm">
              {totalQtyInCart}x
            </span>
          ) : !isOut && hasAddons ? (
            <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs backdrop-blur-xs">
              + Varian / Add-on
            </span>
          ) : null}

          {isOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/55 backdrop-blur-[1px]">
              <span className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow">
                Habis
              </span>
            </div>
          )}
        </div>

        {/* Nama & Kategori Menu */}
        <div className="mt-2.5 px-0.5">
          <h3 className="text-[13px] sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.3rem]">
            {product.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400 truncate">
            {isOut
              ? "Stok habis sementara"
              : hasAddons
                ? "Tap untuk pilih varian & catatan"
                : categoryName || "Siap disajikan"}
          </p>
        </div>
      </button>

      {/* Baris Bawah: Harga & Tombol Aksi Sentuh-Friendly (>= 44px) */}
      <div className="mt-2.5 px-0.5">
        {isOut ? (
          <div className="flex h-11 items-center">
            <span className="text-sm font-extrabold text-slate-400 tabular-nums">
              {formatRupiah(product.price)}
            </span>
          </div>
        ) : totalQtyInCart > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(product.price)}
            </div>
            {hasAddons ? (
              <button
                type="button"
                onClick={() => onOpenOptions(product)}
                className="flex h-11 w-full items-center justify-center gap-1 rounded-full border border-[#1E88E5]/30 bg-[#EBF5FF] px-3 text-xs font-extrabold text-[#1E88E5] hover:bg-[#1E88E5] hover:text-white active:scale-[0.98] transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.75]" />
                <span>Tambah Varian</span>
              </button>
            ) : (
              <div className="flex h-11 w-full items-center justify-between rounded-full border border-sky-200 bg-white px-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => onChangeSingleVariantQty(product.id, -1)}
                  aria-label={`Kurangi ${product.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                >
                  <Minus className="h-4 w-4 stroke-[2.5]" />
                </button>
                <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                  {totalQtyInCart}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeSingleVariantQty(product.id, 1)}
                  aria-label={`Tambah ${product.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E88E5] text-white hover:bg-[#1976D2] active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[2.75]" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] sm:text-sm font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(product.price)}
            </span>
            <button
              type="button"
              onClick={() =>
                hasAddons ? onOpenOptions(product) : onQuickAdd(product)
              }
              aria-label={`Tambah ${product.name} ke keranjang`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-white shadow-[0_4px_12px_rgba(30,136,229,0.28)] hover:bg-[#1976D2] active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-5 w-5 stroke-[2.75]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
