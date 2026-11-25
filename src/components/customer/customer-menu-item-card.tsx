"use client";

import * as React from "react";
import { Coffee, CupSoda, Minus, Plus, Soup, UtensilsCrossed } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import type { ProductRow } from "@/lib/types/database";

interface CustomerMenuItemCardProps {
  product: ProductRow;
  categoryName: string;
  qtyInCart: number;
  noteInCart: string;
  onAdd: (product: ProductRow) => void;
  onChangeQty: (productId: string, delta: number) => void;
}

function renderFallbackMenuIcon(productName: string, categoryName: string) {
  const haystack = `${productName} ${categoryName}`.toLowerCase();
  if (haystack.includes("kopi") || haystack.includes("latte") || haystack.includes("coffee")) {
    return <Coffee className="h-8 w-8 text-amber-700/80" />;
  }
  if (haystack.includes("minum") || haystack.includes("teh") || haystack.includes("es ") || haystack.includes("jus")) {
    return <CupSoda className="h-8 w-8 text-sky-600/80" />;
  }
  if (haystack.includes("ramen") || haystack.includes("mie") || haystack.includes("kuah") || haystack.includes("sup")) {
    return <Soup className="h-8 w-8 text-orange-600/80" />;
  }
  return <UtensilsCrossed className="h-8 w-8 text-emerald-700/75" />;
}

export function CustomerMenuItemCard({
  product,
  categoryName,
  qtyInCart,
  noteInCart,
  onAdd,
  onChangeQty,
}: CustomerMenuItemCardProps) {
  const isOut = !product.is_available;

  return (
    <div
      className={`flex items-stretch justify-between gap-3.5 rounded-2xl border bg-white p-3.5 transition-all ${
        isOut
          ? "border-slate-200/80 bg-slate-50/80 opacity-65"
          : qtyInCart > 0
            ? "border-[#00884A]/35 shadow-[0_2px_12px_rgba(0,136,74,0.08)]"
            : "border-slate-100 shadow-[0_1px_6px_rgba(15,23,42,0.04)] hover:border-slate-200 hover:shadow-sm"
      }`}
    >
      {/* Kolom Kiri: Nama Menu, Deskripsi/Kategori & Harga */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <h3 className="text-[15px] font-extrabold uppercase tracking-tight text-slate-900 leading-snug line-clamp-2">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {isOut
              ? "Stok sedang habis sementara"
              : noteInCart.trim()
                ? `Catatan: ${noteInCart.trim()}`
                : categoryName
                  ? `${categoryName} \u2022 Siap disajikan untuk meja Anda`
                  : "Menu pilihan \u2022 Siap disajikan untuk meja Anda"}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-extrabold text-slate-900 tabular-nums">
            {formatRupiah(product.price)}
          </span>
          {qtyInCart > 0 && !isOut && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-bold text-[#00884A]">
              {qtyInCart} di keranjang
            </span>
          )}
        </div>
      </div>

      {/* Kolom Kanan: Thumbnail Gambar + Tombol + atau Pill - qty + ala Menu Modern */}
      <div className="relative flex w-[104px] shrink-0 flex-col items-center pb-3">
        <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 shadow-2xs flex items-center justify-center">
          {product.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            renderFallbackMenuIcon(product.name, categoryName)
          )}

          {isOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/55 backdrop-blur-[1px]">
              <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
                Habis
              </span>
            </div>
          )}
        </div>

        {/* Kontrol Aksi Keranjang Melayang di Bagian Bawah Gambar */}
        {!isOut && (
          <div className="absolute bottom-0 inset-x-0 flex justify-center">
            {qtyInCart > 0 ? (
              <div className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-1 shadow-md">
                <button
                  type="button"
                  onClick={() => onChangeQty(product.id, -1)}
                  aria-label={`Kurangi ${product.name}`}
                  className="flex h-9 w-8 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
                <span className="min-w-6 text-center text-sm font-extrabold text-slate-900 tabular-nums">
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeQty(product.id, 1)}
                  aria-label={`Tambah ${product.name}`}
                  className="flex h-9 w-8 items-center justify-center rounded-full text-[#00884A] hover:bg-emerald-50 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.75]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAdd(product)}
                aria-label={`Tambah ${product.name} ke keranjang`}
                className="ml-auto mr-0.5 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#00884A]/20 bg-white text-[#00884A] shadow-md hover:border-[#00884A] hover:bg-[#00884A] hover:text-white active:scale-95 transition cursor-pointer"
              >
                <Plus className="h-5 w-5 stroke-[2.75]" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
