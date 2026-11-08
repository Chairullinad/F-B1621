"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/money";
import {
  createPurchaseOrderAction,
  createSupplierAction,
  paySupplierPurchaseOrderAction,
  receivePurchaseOrderAction,
  type SupplierPageData,
} from "@/server/inventory";

export function SupplierPoManager({
  initialData,
}: {
  initialData: SupplierPageData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [showAddSupplier, setShowAddSupplier] = React.useState(false);

  // Form supplier
  const [supName, setSupName] = React.useState("");
  const [supCat, setSupCat] = React.useState("Daging & Ayam");
  const [supContact, setSupContact] = React.useState("");
  const [supAddress, setSupAddress] = React.useState("");
  const [supTerm, setSupTerm] = React.useState<
    "COD" | "7 Hari" | "14 Hari" | "30 Hari"
  >("14 Hari");

  // Form PO
  const [poSupplierId, setPoSupplierId] = React.useState(
    initialData.suppliers[0]?.id ?? ""
  );
  const [poIngredientId, setPoIngredientId] = React.useState(
    initialData.ingredients[0]?.id ?? ""
  );
  const [poQty, setPoQty] = React.useState("25");
  const [poUnitCost, setPoUnitCost] = React.useState(
    String(initialData.ingredients[0]?.unit_cost ?? 15000)
  );

  const totalPayables = initialData.suppliers.reduce(
    (s, x) => s + Number(x.payable_balance),
    0
  );
  const activePoCount = initialData.purchaseOrders.filter(
    (p) => p.status === "pending" || p.status === "dikirim"
  ).length;
  const totalPoValue = initialData.purchaseOrders.reduce(
    (s, p) => s + Number(p.total_amount),
    0
  );

  function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupplierAction({
        name: supName,
        category: supCat,
        contact: supContact,
        address: supAddress,
        paymentTerm: supTerm,
        rating: 5,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSupName("");
      setSupContact("");
      setSupAddress("");
      setShowAddSupplier(false);
      router.refresh();
    });
  }

  function handleCreatePo(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPurchaseOrderAction({
        supplierId: poSupplierId,
        ingredientId: poIngredientId,
        qty: Number(poQty) || 0,
        unitCost: parseInt(poUnitCost, 10) || 0,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleReceivePo(poId: string) {
    startTransition(async () => {
      const res = await receivePurchaseOrderAction({ poId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handlePayPo(poId: string) {
    startTransition(async () => {
      const res = await paySupplierPurchaseOrderAction({ poId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Total Supplier
          </div>
          <div className="mt-1 text-3xl font-extrabold text-slate-900">
            {initialData.suppliers.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {initialData.suppliers.filter((s) => s.is_active).length} supplier
            aktif
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Total Hutang Usaha
          </div>
          <div className="mt-1 text-2xl font-extrabold text-amber-600">
            {formatRupiah(totalPayables)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tercatat di Neraca (Kewajiban)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">PO Aktif</div>
          <div className="mt-1 text-3xl font-extrabold text-blue-600">
            {activePoCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Menunggu penerimaan gudang
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Total PO Periode Ini
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">
            {formatRupiah(totalPoValue)}
          </div>
          <div className="mt-1 text-xs text-emerald-700">
            Terintegrasi ke Persediaan &amp; PPN Masukan
          </div>
        </div>
      </div>

      {/* Daftar Supplier */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">
            Daftar Supplier — 1621 Group
          </h3>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddSupplier(!showAddSupplier)}
            className="bg-[#1E88E5] text-white hover:bg-[#1976D2]"
          >
            {showAddSupplier ? "Tutup Form" : "+ Tambah Supplier"}
          </Button>
        </div>

        {showAddSupplier ? (
          <form
            onSubmit={handleCreateSupplier}
            className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-5"
          >
            <Input
              placeholder="Nama Perusahaan Supplier"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              required
            />
            <Input
              placeholder="Kategori Bahan"
              value={supCat}
              onChange={(e) => setSupCat(e.target.value)}
              required
            />
            <Input
              placeholder="No. Telepon / Kontak"
              value={supContact}
              onChange={(e) => setSupContact(e.target.value)}
              required
            />
            <Input
              placeholder="Alamat Lengkap"
              value={supAddress}
              onChange={(e) => setSupAddress(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <select
                value={supTerm}
                onChange={(e) =>
                  setSupTerm(
                    e.target.value as "COD" | "7 Hari" | "14 Hari" | "30 Hari"
                  )
                }
                className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs"
              >
                <option value="COD">COD</option>
                <option value="7 Hari">7 Hari</option>
                <option value="14 Hari">14 Hari</option>
                <option value="30 Hari">30 Hari</option>
              </select>
              <Button type="submit" size="sm" disabled={isPending}>
                Simpan
              </Button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                <th className="px-3 py-2.5">Nama Supplier</th>
                <th className="px-3 py-2.5">Kategori</th>
                <th className="px-3 py-2.5">Kontak</th>
                <th className="px-3 py-2.5">Termin</th>
                <th className="px-3 py-2.5">Rating</th>
                <th className="px-3 py-2.5 text-right">Hutang Usaha</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialData.suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.address}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                      {s.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                    {s.contact}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700">
                    {s.payment_term}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700">
                    {s.rating}/5
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {s.payable_balance > 0 ? (
                      <strong className="text-amber-600">
                        {formatRupiah(s.payable_balance)}
                      </strong>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        s.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {s.is_active ? "aktif" : "nonaktif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buat PO Baru */}
      <form
        onSubmit={handleCreatePo}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <h3 className="mb-3 text-base font-bold text-slate-900">
          Buat Purchase Order (PO) Bahan Baku
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Pilih Supplier
            </label>
            <select
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {initialData.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.payment_term})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Bahan Baku
            </label>
            <select
              value={poIngredientId}
              onChange={(e) => {
                setPoIngredientId(e.target.value);
                const found = initialData.ingredients.find(
                  (i) => i.id === e.target.value
                );
                if (found) setPoUnitCost(String(found.unit_cost));
              }}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {initialData.ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Kuantitas Beli
            </label>
            <Input
              type="number"
              step="0.5"
              min="1"
              value={poQty}
              onChange={(e) => setPoQty(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Harga Beli / Satuan (Rp)
            </label>
            <Input
              type="number"
              min="100"
              value={poUnitCost}
              onChange={(e) => setPoUnitCost(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-[#1E88E5] text-white hover:bg-[#1976D2]"
          >
            {isPending ? "Membuat PO..." : "Terbitkan Purchase Order"}
          </Button>
        </div>
      </form>

      {/* Daftar Purchase Order */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          Daftar Purchase Order (PO)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                <th className="px-3 py-2.5">No. PO</th>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5">Tanggal</th>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialData.purchaseOrders.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-extrabold text-slate-900">
                    {p.po_no}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    {p.supplier_name_snapshot}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{p.order_date}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700">
                    {p.items_summary}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    {formatRupiah(Number(p.total_amount))}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        p.status === "lunas" || p.status === "diterima"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.status === "dikirim"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.status === "pending" || p.status === "dikirim" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleReceivePo(p.id)}
                        className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                      >
                        ✓ Terima Barang (+Stok)
                      </button>
                    ) : p.status === "diterima" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handlePayPo(p.id)}
                        className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 hover:bg-blue-200"
                      >
                        Lunasi Hutang
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Selesai</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

