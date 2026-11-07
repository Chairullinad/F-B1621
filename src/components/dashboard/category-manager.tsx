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
import type { CategoryRow } from "@/lib/types/database";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/master-data";

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: ReadonlyArray<CategoryRow>;
}) {
  const [name, setName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<string>(
    String((initialCategories.length + 1) * 10)
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editSortOrder, setEditSortOrder] = React.useState("0");
  const [editActive, setEditActive] = React.useState(true);
  const [isPending, startTransition] = React.useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedSort = Number.parseInt(sortOrder, 10);
    if (!Number.isFinite(parsedSort)) {
      toast.error("Urutan tampil harus berupa angka bulat.");
      return;
    }

    startTransition(async () => {
      const res = await createCategoryAction({
        name,
        sortOrder: parsedSort,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setName("");
      setSortOrder(String(parsedSort + 10));
    });
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(String(cat.sort_order));
    setEditActive(cat.is_active);
  }

  function handleSaveEdit(id: string) {
    const parsedSort = Number.parseInt(editSortOrder, 10);
    if (!Number.isFinite(parsedSort)) {
      toast.error("Urutan tampil harus berupa angka bulat.");
      return;
    }

    startTransition(async () => {
      const res = await updateCategoryAction({
        id,
        name: editName,
        sortOrder: parsedSort,
        isActive: editActive,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setEditingId(null);
    });
  }

  function handleDelete(cat: CategoryRow) {
    startTransition(async () => {
      const res = await deleteCategoryAction({ id: cat.id });
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
          <CardTitle className="text-base">Tambah Kategori Baru</CardTitle>
          <CardDescription>
            Atur pengelompokan menu dan urutan tampil di layar pelanggan serta
            kasir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="cat-name" className="block text-sm font-medium">
                Nama Kategori
              </label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Kopi Spesial"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cat-sort" className="block text-sm font-medium">
                Urutan Tampil
              </label>
              <Input
                id="cat-sort"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Kategori"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Kategori ({initialCategories.length})
          </CardTitle>
          <CardDescription>
            Urut dari angka terkecil ke terbesar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialCategories.map((cat) => {
            const isEditing = editingId === cat.id;

            if (isEditing) {
              return (
                <div
                  key={cat.id}
                  className="space-y-3 rounded-xl border border-zinc-900 bg-zinc-50 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">
                        Nama Kategori
                      </label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">
                        Urutan Tampil
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={editSortOrder}
                        onChange={(e) => setEditSortOrder(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        className="h-5 w-5 rounded border-zinc-300"
                      />
                      Kategori Aktif
                    </label>

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
                        onClick={() => handleSaveEdit(cat.id)}
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
                key={cat.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Urutan #{cat.sort_order}</Badge>
                    <span className="font-semibold">{cat.name}</span>
                    <Badge variant={cat.is_active ? "success" : "secondary"}>
                      {cat.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(cat)}
                    disabled={isPending}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(cat)}
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
