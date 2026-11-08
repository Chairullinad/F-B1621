"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/money";
import type { CategoryRow, ProductRow } from "@/lib/types/database";
import {
  createProductAction,
  deleteProductAction,
  toggleProductAvailabilityAction,
  updateProductAction,
} from "@/server/master-data";

export function ProductManager({
  initialProducts,
  categories,
}: {
  initialProducts: ReadonlyArray<ProductRow>;
  categories: ReadonlyArray<CategoryRow>;
}) {
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(
    categories[0]?.id ?? ""
  );
  const [priceStr, setPriceStr] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [isAvailable, setIsAvailable] = React.useState(true);

  const [filterCategoryId, setFilterCategoryId] = React.useState("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editCategoryId, setEditCategoryId] = React.useState("");
  const [editPriceStr, setEditPriceStr] = React.useState("");
  const [editImageUrl, setEditImageUrl] = React.useState("");
  const [editIsAvailable, setEditIsAvailable] = React.useState(true);
  const [editIsActive, setEditIsActive] = React.useState(true);

  const [isPending, startTransition] = React.useTransition();

  const categoryNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const filteredProducts = React.useMemo(() => {
    return initialProducts.filter((p) => {
      if (filterCategoryId !== "ALL" && p.category_id !== filterCategoryId) {
        return false;
      }
      if (
        searchQuery.trim().length > 0 &&
        !p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [initialProducts, filterCategoryId, searchQuery]);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedPrice = Number.parseInt(priceStr, 10);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
      toast.error("Harga harus berupa bilangan bulat Rupiah (contoh: 25000).");
      return;
    }

    startTransition(async () => {
      const res = await createProductAction({
        categoryId,
        name,
        price: parsedPrice,
        imageUrl: imageUrl.trim() || null,
        isAvailable,
        isActive: true,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setName("");
      setPriceStr("");
      setImageUrl("");
      setIsAvailable(true);
    });
  }

  function handleQuickToggleAvailability(product: ProductRow) {
    startTransition(async () => {
      const res = await toggleProductAvailabilityAction({
        id: product.id,
        isAvailable: !product.is_available,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  function startEdit(product: ProductRow) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditCategoryId(product.category_id);
    setEditPriceStr(String(product.price));
    setEditImageUrl(product.image_url ?? "");
    setEditIsAvailable(product.is_available);
    setEditIsActive(product.is_active);
  }

  function handleSaveEdit(id: string) {
    const parsedPrice = Number.parseInt(editPriceStr, 10);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
      toast.error("Harga harus berupa bilangan bulat Rupiah.");
      return;
    }

    startTransition(async () => {
      const res = await updateProductAction({
        id,
        categoryId: editCategoryId,
        name: editName,
        price: parsedPrice,
        imageUrl: editImageUrl.trim() || null,
        isAvailable: editIsAvailable,
        isActive: editIsActive,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setEditingId(null);
    });
  }

  function handleDelete(product: ProductRow) {
    startTransition(async () => {
      const res = await deleteProductAction({ id: product.id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Tambah Produk Baru</CardTitle>
          <CardDescription>
            Masukkan harga dalam bilangan bulat Rupiah (contoh: <code>25000</code>{" "}
            untuk {formatRupiah(25000)}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="block text-sm font-medium">
                Nama Produk
              </label>
              <Input
                id="prod-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Es Kopi Susu Gula Aren"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prod-cat" className="block text-sm font-medium">
                Kategori
              </label>
              <select
                id="prod-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isPending}
                className="flex min-h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-xs transition-all duration-150 focus:border-[#0284C7] focus:ring-4 focus:ring-sky-500/10 outline-hidden"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prod-price" className="block text-sm font-medium">
                Harga (Rupiah Bulat)
              </label>
              <Input
                id="prod-price"
                type="number"
                min={0}
                step={1}
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="25000"
                required
                disabled={isPending}
              />
              {priceStr && Number.isInteger(Number(priceStr)) ? (
                <p className="text-xs font-medium text-zinc-600">
                  Tampilan: {formatRupiah(Number(priceStr))}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prod-img" className="block text-sm font-medium">
                URL Foto Produk (Opsional)
              </label>
              <Input
                id="prod-img"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                disabled={isPending}
              />
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300"
              />
              Tersedia untuk Dipesan (Tidak Habis)
            </label>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="space-y-3">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base">
                Daftar Produk ({filteredProducts.length} /{" "}
                {initialProducts.length})
              </CardTitle>
              <CardDescription>
                Gunakan tombol <strong>Tandai Habis / Tersedia</strong> untuk
                mengubah ketersediaan stok dengan cepat.
              </CardDescription>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk..."
            />
            <select
              aria-label="Filter kategori"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="flex min-h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-xs transition-all duration-150 focus:border-[#0284C7] focus:ring-4 focus:ring-sky-500/10 outline-hidden"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {filteredProducts.map((product) => {
            const isEditing = editingId === product.id;

            if (isEditing) {
              return (
                <div
                  key={product.id}
                  className="space-y-3 rounded-xl border border-zinc-900 bg-zinc-50 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-xs font-medium text-zinc-700">
                        Nama Produk
                      </label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-xs font-medium text-zinc-700">
                        Kategori
                      </label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        disabled={isPending}
                        className="flex min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-xs font-medium text-zinc-700">
                        Harga (Rp)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={editPriceStr}
                        onChange={(e) => setEditPriceStr(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-700">
                      URL Foto Produk (Opsional)
                    </label>
                    <Input
                      type="url"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="https://..."
                      disabled={isPending}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={editIsAvailable}
                          onChange={(e) =>
                            setEditIsAvailable(e.target.checked)
                          }
                          className="h-5 w-5 rounded border-zinc-300"
                        />
                        Tersedia (Tidak Habis)
                      </label>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                          className="h-5 w-5 rounded border-zinc-300"
                        />
                        Aktif di Menu
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(product.id)}
                        disabled={isPending}
                      >
                        Simpan Perubahan
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={product.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{product.name}</span>
                    <Badge variant="outline">
                      {categoryNameMap.get(product.category_id) ?? "Kategori"}
                    </Badge>
                    <Badge
                      variant={
                        product.is_available ? "success" : "destructive"
                      }
                    >
                      {product.is_available ? "Tersedia" : "Habis"}
                    </Badge>
                    {!product.is_active ? (
                      <Badge variant="secondary">Disembunyikan</Badge>
                    ) : null}
                  </div>
                  <p className="text-base font-bold text-zinc-900">
                    {formatRupiah(product.price)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={product.is_available ? "secondary" : "default"}
                    size="sm"
                    onClick={() => handleQuickToggleAvailability(product)}
                    disabled={isPending}
                  >
                    {product.is_available
                      ? "Tandai Habis"
                      : "Tandai Tersedia"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(product)}
                    disabled={isPending}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(product)}
                    disabled={isPending}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
