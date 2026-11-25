"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Edit3,
  FolderPlus,
  ImagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ProductAddonGroupWithOptions } from "@/lib/addons";
import { formatRupiah } from "@/lib/money";
import type {
  CategoryRow,
  ProductAddonAssignmentRow,
  ProductRow,
} from "@/lib/types/database";
import type { OutletAddonCatalog } from "@/server/addon-helpers";
import {
  createCategoryAction,
  createProductAction,
  deleteCategoryAction,
  deleteProductAction,
  toggleProductAvailabilityAction,
  updateProductAction,
} from "@/server/master-data";
import { setProductAddonGroupsAction } from "@/server/product-addons";
import { AddonSettingsModal } from "./addon-settings-modal";

export function ProductManager({
  initialProducts,
  categories: initialCategories,
  initialAddonCatalog,
}: {
  initialProducts: ReadonlyArray<ProductRow>;
  categories: ReadonlyArray<CategoryRow>;
  initialAddonCatalog: OutletAddonCatalog;
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
  const [showAddonModal, setShowAddonModal] = React.useState(false);

  // Add-on assignment state per produk
  const [addonGroups, setAddonGroups] = React.useState<ProductAddonGroupWithOptions[]>(
    () => [...initialAddonCatalog.groups]
  );
  const [addonAssignments, setAddonAssignments] = React.useState<
    ProductAddonAssignmentRow[]
  >(() => [...initialAddonCatalog.assignments]);

  React.useEffect(() => {
    setAddonGroups([...initialAddonCatalog.groups]);
    setAddonAssignments([...initialAddonCatalog.assignments]);
  }, [initialAddonCatalog]);

  // Form Tambah Produk
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(
    initialCategories[0]?.id ?? ""
  );
  const [priceStr, setPriceStr] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [createAddonGroupIds, setCreateAddonGroupIds] = React.useState<string[]>([]);

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
  const [editAddonGroupIds, setEditAddonGroupIds] = React.useState<string[]>([]);

  const [isPending, startTransition] = React.useTransition();
  const [isProcessingImage, setIsProcessingImage] = React.useState(false);

  async function compressProductImageToDataUrl(file: File): Promise<string> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const maxDim = 480;
    const w = img.naturalWidth || img.width || 480;
    const h = img.naturalHeight || img.height || 480;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function handleUploadImage(
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "create" | "edit"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    try {
      const dataUrl = await compressProductImageToDataUrl(file);
      if (mode === "create") {
        setImageUrl(dataUrl);
      } else {
        setEditImageUrl(dataUrl);
      }
      toast.success("Foto menu berhasil dimuat! Klik Simpan untuk menerapkan.");
    } catch {
      toast.error("Gagal membaca file gambar. Pastikan format JPG/PNG/WEBP.");
    } finally {
      setIsProcessingImage(false);
      e.target.value = "";
    }
  }

  const categoryNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const addonGroupMap = React.useMemo(() => {
    const map = new Map<string, ProductAddonGroupWithOptions>();
    for (const g of addonGroups) {
      map.set(g.id, g);
    }
    return map;
  }, [addonGroups]);

  const addonGroupIdsByProduct = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of addonAssignments) {
      if (!addonGroupMap.has(a.addon_group_id)) continue;
      const list = map.get(a.product_id) ?? [];
      if (!list.includes(a.addon_group_id)) {
        list.push(a.addon_group_id);
      }
      map.set(a.product_id, list);
    }
    return map;
  }, [addonAssignments, addonGroupMap]);

  function toggleGroupInList(list: string[], groupId: string): string[] {
    return list.includes(groupId)
      ? list.filter((id) => id !== groupId)
      : [...list, groupId];
  }

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
      if (res.product && createAddonGroupIds.length > 0 && initialAddonCatalog.schemaReady) {
        await setProductAddonGroupsAction({
          productId: res.product.id,
          addonGroupIds: createAddonGroupIds,
        });
      }
      toast.success(res.message);
      if (res.product) {
        setProducts((prev) => [res.product!, ...prev]);
      }
      setName("");
      setPriceStr("");
      setImageUrl("");
      setIsAvailable(true);
      setCreateAddonGroupIds([]);
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
    setEditAddonGroupIds(addonGroupIdsByProduct.get(product.id) ?? []);
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
    const targetAddonGroupIds = [...editAddonGroupIds];
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
      if (initialAddonCatalog.schemaReady) {
        const addonRes = await setProductAddonGroupsAction({
          productId: targetId,
          addonGroupIds: targetAddonGroupIds,
        });
        if (!addonRes.ok) {
          toast.error(addonRes.message);
        }
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
            onClick={() => setShowAddonModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-[#EBF5FF] dark:bg-sky-950/50 px-3.5 text-[13px] font-semibold text-[#1E88E5] dark:text-sky-300 hover:bg-sky-100 transition cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Kelola Add-On ({addonGroups.length})</span>
          </button>

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
                        {product.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-11 w-11 rounded-lg border border-slate-200 dark:border-slate-700 object-cover bg-white shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            <UtensilsCrossed className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                            {product.name}
                          </span>
                          {(addonGroupIdsByProduct.get(product.id)?.length ?? 0) > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {addonGroupIdsByProduct.get(product.id)?.map((gid) => {
                                const grp = addonGroupMap.get(gid);
                                if (!grp) return null;
                                return (
                                  <span
                                    key={gid}
                                    className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 px-1.5 py-0.5 text-[10px] font-semibold text-[#1E88E5] dark:text-sky-300"
                                  >
                                    + {grp.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
          <div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
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

              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  Foto Menu (Upload File / URL)
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  {imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrl}
                      alt="Pratinjau Menu"
                      className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3 text-[12px] font-semibold text-white hover:bg-[#1976D2] transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {isProcessingImage ? "Memuat..." : "Upload Foto"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadImage(e, "create")}
                          className="hidden"
                          disabled={isPending || isProcessingImage}
                        />
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl("")}
                          className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Atau tempel URL/path foto (cth: https://... atau /menu/...)"
                      value={imageUrl.startsWith("data:image/") ? "" : imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[12px] text-slate-700 dark:text-slate-200 focus:border-[#1E88E5] outline-hidden"
                    />
                  </div>
                </div>
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

              {addonGroups.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Add-On untuk Menu Ini (Opsional)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {createAddonGroupIds.length} dipilih
                    </span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {addonGroups.map((grp) => (
                      <label
                        key={grp.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={createAddonGroupIds.includes(grp.id)}
                            onChange={() =>
                              setCreateAddonGroupIds((prev) =>
                                toggleGroupInList(prev, grp.id)
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#1E88E5]"
                          />
                          <span className="truncate">{grp.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {grp.options.length} opsi
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
          <div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
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

              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  Foto Menu (Upload File / URL)
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  {editImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={editImageUrl}
                      alt="Pratinjau Menu"
                      className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3 text-[12px] font-semibold text-white hover:bg-[#1976D2] transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {isProcessingImage ? "Memuat..." : "Upload / Ganti Foto"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadImage(e, "edit")}
                          className="hidden"
                          disabled={isPending || isProcessingImage}
                        />
                      </label>
                      {editImageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditImageUrl("")}
                          className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Atau tempel URL/path foto (cth: https://... atau /menu/...)"
                      value={
                        editImageUrl.startsWith("data:image/")
                          ? ""
                          : editImageUrl
                      }
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[12px] text-slate-700 dark:text-slate-200 focus:border-[#1E88E5] outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {addonGroups.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Add-On untuk Menu Ini (Opsional)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {editAddonGroupIds.length} aktif
                    </span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {addonGroups.map((grp) => (
                      <label
                        key={grp.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={editAddonGroupIds.includes(grp.id)}
                            onChange={() =>
                              setEditAddonGroupIds((prev) =>
                                toggleGroupInList(prev, grp.id)
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#1E88E5]"
                          />
                          <span className="truncate">{grp.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {grp.options.length} opsi
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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

      <AddonSettingsModal
        open={showAddonModal}
        onClose={() => setShowAddonModal(false)}
        schemaReady={initialAddonCatalog.schemaReady}
        groups={addonGroups}
        assignments={addonAssignments}
        products={products}
        categories={categories}
        onUpdated={() => router.refresh()}
      />
    </div>
  );
}
