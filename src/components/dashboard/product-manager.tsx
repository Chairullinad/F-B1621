"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Edit3,
  FolderPlus,
  Plus,
  Search,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/money";
import type { CategoryRow, ProductRow } from "@/lib/types/database";
import {
  createCategoryAction,
  createProductAction,
  deleteCategoryAction,
  deleteProductAction,
  toggleProductAvailabilityAction,
  updateProductAction,
} from "@/server/master-data";

export function ProductManager({
  initialProducts,
  categories: initialCategories,
}: {
  initialProducts: ReadonlyArray<ProductRow>;
  categories: ReadonlyArray<CategoryRow>;
}) {
  const router = useRouter();
  const [products, setProducts] = React.useState<ProductRow[]>([
    ...initialProducts,
  ]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([
    ...initialCategories,
  ]);

  React.useEffect(() => {
    setProducts([...initialProducts]);
  }, [initialProducts]);

  React.useEffect(() => {
    setCategories([...initialCategories]);
  }, [initialCategories]);

  // Modal State
  const [showAddProductModal, setShowAddProductModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);

  // Form Tambah Produk
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(
    initialCategories[0]?.id ?? ""
  );
  const [priceStr, setPriceStr] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [isAvailable, setIsAvailable] = React.useState(true);

  // Form Tambah Kategori
  const [newCategoryName, setNewCategoryName] = React.useState("");

  // Filter & Search
  const [filterCategoryId, setFilterCategoryId] = React.useState("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Edit Produk
  const [editingProduct, setEditingProduct] =
    React.useState<ProductRow | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editCategoryId, setEditCategoryId] = React.useState("");
  const [editPriceStr, setEditPriceStr] = React.useState("");
  const [editImageUrl, setEditImageUrl] = React.useState("");
  const [editIsAvailable, setEditIsAvailable] = React.useState(true);

  const [isPending, startTransition] = React.useTransition();

  const categoryNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
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
  }, [products, filterCategoryId, searchQuery]);

  function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;

    startTransition(async () => {
      const res = await createCategoryAction({
        name: cleanName,
        sortOrder: categories.length + 1,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      if (res.category) {
        setCategories((prev) => [...prev, res.category!]);
        if (!categoryId) setCategoryId(res.category.id);
      }
      setNewCategoryName("");
      router.refresh();
    });
  }

  function handleDeleteCategory(id: string) {
    startTransition(async () => {
      const res = await deleteCategoryAction({ id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    });
  }

  function handleCreateProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedPrice = Number.parseInt(priceStr, 10);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
      toast.error("Harga harus berupa bilangan bulat Rupiah (contoh: 25000).");
      return;
    }

    startTransition(async () => {
      const res = await createProductAction({
        categoryId: categoryId || (categories[0]?.id ?? ""),
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
      if (res.product) {
        setProducts((prev) => [res.product!, ...prev]);
      }
      setName("");
      setPriceStr("");
      setImageUrl("");
      setIsAvailable(true);
      setShowAddProductModal(false);
      router.refresh();
    });
  }

  function handleQuickToggleAvailability(product: ProductRow) {
    const nextState = !product.is_available;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, is_available: nextState } : p
      )
    );

    startTransition(async () => {
      const res = await toggleProductAvailabilityAction({
        id: product.id,
        isAvailable: nextState,
      });
      if (!res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, is_available: !nextState } : p
          )
        );
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function startEdit(product: ProductRow) {
    setEditingProduct(product);
    setEditName(product.name);
    setEditCategoryId(product.category_id);
    setEditPriceStr(String(product.price));
    setEditImageUrl(product.image_url ?? "");
    setEditIsAvailable(product.is_available);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    const parsedPrice = Number.parseInt(editPriceStr, 10);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
      toast.error("Harga harus berupa bilangan bulat Rupiah.");
      return;
    }

    const targetId = editingProduct.id;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
              ...p,
              name: editName,
              category_id: editCategoryId,
              price: parsedPrice,
              image_url: editImageUrl.trim() || null,
              is_available: editIsAvailable,
            }
          : p
      )
    );
    setEditingProduct(null);

    startTransition(async () => {
      const res = await updateProductAction({
        id: targetId,
        categoryId: editCategoryId,
        name: editName,
        price: parsedPrice,
        imageUrl: editImageUrl.trim() || null,
        isAvailable: editIsAvailable,
        isActive: true,
      });
      if (!res.ok) {
        setProducts([...initialProducts]);
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleDelete(product: ProductRow) {
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    startTransition(async () => {
      const res = await deleteProductAction({ id: product.id });
      if (!res.ok) {
        setProducts([...initialProducts]);
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 bg-[#F4F7FA] dark:bg-slate-950 -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800 dark:text-slate-100">
      {/* Breadcrumb & Header ala ESB POSLite */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[12px] text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-[#1E88E5]">
              Beranda
            </Link>{" "}
            &gt;{" "}
            <span className="text-slate-600 dark:text-slate-300">
              Daftar Menu &amp; Kategori
            </span>
          </div>
          <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100 mt-1">
            Daftar Menu &amp; Kategori Kedai
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola katalog menu makanan &amp; minuman, kategori, harga integer Rupiah, dan ketersediaan stok.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
          >
            <FolderPlus className="h-4 w-4 text-slate-500" />
            <span>Kelola Kategori ({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!categoryId && categories[0]) {
                setCategoryId(categories[0].id);
              }
              setShowAddProductModal(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1E88E5] px-4 text-[13px] font-semibold text-white shadow-2xs hover:bg-[#1976D2] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Menu Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Tabel Menu ala ESB POSLite */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Pill Kategori */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterCategoryId("ALL")}
              className={`h-9 rounded-lg px-3.5 text-[13px] font-semibold transition cursor-pointer ${
                filterCategoryId === "ALL"
                  ? "bg-[#1E88E5] text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
              }`}
            >
              Semua Kategori ({products.length})
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.category_id === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilterCategoryId(c.id)}
                  className={`h-9 rounded-lg px-3.5 text-[13px] font-semibold transition cursor-pointer ${
                    filterCategoryId === c.id
                      ? "bg-[#1E88E5] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                  }`}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="flex w-full sm:w-72 items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-[#1E88E5] overflow-hidden">
            <input
              type="text"
              placeholder="Cari nama menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-hidden bg-transparent"
            />
            <div className="px-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Tabel Daftar Menu */}
        <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] dark:bg-slate-800/80 text-[13px] font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3">Nama Menu</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-center">Ketersediaan</th>
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[14px]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-[13px] text-slate-400"
                  >
                    Belum ada menu pada kategori ini. Klik tombol{" "}
                    <strong>+ Tambah Menu Baru</strong> di kanan atas untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {product.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                        <Tag className="h-3 w-3 text-slate-400" />
                        {categoryNameMap.get(product.category_id) ??
                          "Tanpa Kategori"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatRupiah(product.price)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={product.is_available}
                          onChange={() =>
                            handleQuickToggleAvailability(product)
                          }
                        />
                        <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1E88E5]" />
                        <span
                          className={`ml-2 text-[12px] font-semibold ${
                            product.is_available
                              ? "text-[#1E88E5]"
                              : "text-rose-600"
                          }`}
                        >
                          {product.is_available ? "Tersedia" : "Habis"}
                        </span>
                      </label>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(product)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Menu Baru */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
                  Tambah Menu Baru
                </h3>
                <p className="text-[12px] text-slate-500">
                  Masukkan nama menu, kategori, dan harga dalam Rupiah bulat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nama Menu *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Es Kopi Susu 1621"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Kategori Menu *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Harga Jual (Rupiah Bulat) *
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  placeholder="25000"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
                {priceStr && Number.isInteger(Number(priceStr)) && (
                  <p className="mt-1 text-[12px] font-semibold text-[#1E88E5]">
                    Tampilan di Kasir &amp; QR Meja:{" "}
                    {formatRupiah(Number(priceStr))}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  URL Foto Menu (Opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-[13px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1E88E5]"
                />
                <span>Langsung Tersedia untuk Dipesan</span>
              </label>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5] text-[13px] font-semibold text-white hover:bg-[#1976D2] cursor-pointer disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  <span>{isPending ? "Menyimpan..." : "Simpan Menu"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Menu */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
                  Ubah Data Menu
                </h3>
                <p className="text-[12px] text-slate-500">
                  Perubahan harga otomatis tercatat di Jejak Audit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nama Menu *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Kategori *
                </label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Harga Jual (Rupiah Bulat) *
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={editPriceStr}
                  onChange={(e) => setEditPriceStr(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-lg bg-[#1E88E5] text-[13px] font-semibold text-white hover:bg-[#1976D2] cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Kategori */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
                  Kelola Kategori Menu
                </h3>
                <p className="text-[12px] text-slate-500">
                  Tambah atau hapus kategori menu untuk cabang ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Nama kategori baru (misal: Kopi, Ramen)..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-[13px] outline-hidden focus:border-[#1E88E5]"
              />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center gap-1 rounded-lg bg-[#1E88E5] px-4 text-[13px] font-semibold text-white hover:bg-[#1976D2] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah</span>
              </button>
            </form>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3.5 py-2.5 text-[13px]"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {cat.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-rose-600 hover:text-rose-700 text-[12px] font-medium cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
