"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/money";
import {
  approveStockTransferAction,
  createStockTransferAction,
  receiveStockTransferAction,
  type StockTransferPageData,
} from "@/server/inventory";

interface TransferStockManagerProps {
  initialData: StockTransferPageData;
}

const LOCATIONS = ["Gudang Utama", "Dapur Utama", "Bar Minuman"] as const;

export function TransferStockManager({
  initialData,
}: TransferStockManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fromLocation, setFromLocation] =
    useState<(typeof LOCATIONS)[number]>("Gudang Utama");
  const [toLocation, setToLocation] =
    useState<(typeof LOCATIONS)[number]>("Dapur Utama");
  const [ingredientId, setIngredientId] = useState<string>(
    initialData.ingredients[0]?.id ?? ""
  );
  const [qty, setQty] = useState<string>("5");
  const [notes, setNotes] = useState<string>("");

  const canApprove =
    initialData.currentRole === "owner" ||
    initialData.currentRole === "cashier";

  const pendingCount = initialData.transfers.filter(
    (t) => t.status === "pending"
  ).length;
  const inTransitCount = initialData.transfers.filter(
    (t) => t.status === "in_transit"
  ).length;
  const receivedCount = initialData.transfers.filter(
    (t) => t.status === "received"
  ).length;
  const totalValueTransferred = initialData.transfers
    .filter((t) => t.status === "received")
    .reduce((s, t) => s + t.total_value, 0);

  const selectedIngredient = initialData.ingredients.find(
    (i) => i.id === ingredientId
  );

  function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createStockTransferAction({
        fromLocation,
        toLocation,
        ingredientId,
        qty: Number(qty),
        notes: notes.trim() || undefined,
      });
      setFeedback(res);
      if (res.ok) {
        setShowCreateModal(false);
        setQty("5");
        setNotes("");
        router.refresh();
      }
    });
  }

  function handleApprove(transferId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await approveStockTransferAction({ transferId });
      setFeedback(res);
      if (res.ok) router.refresh();
    });
  }

  function handleReceive(transferId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await receiveStockTransferAction({ transferId });
      setFeedback(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-100 dark:bg-indigo-950/60 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              MUTASI INTERNAL 3 LOKASI
            </span>
            <span className="rounded-lg bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Auto-Jurnal In-Transit
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-bold text-slate-900 dark:text-slate-100">
            Transfer / Mutasi Stok Antar Penyimpanan
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Alur terverifikasi 2 tahap: Request Transfer → Approve Pengiriman
            (In-Transit) → Konfirmasi Terima di Lokasi Tujuan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <span>+ Buat Transfer Stok</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            Menunggu Approval
          </p>
          <p className="mt-1.5 text-2xl font-bold text-amber-600">
            {pendingCount} Dokumen
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Perlu persetujuan Owner / Kasir
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            Sedang Dikirim (In-Transit)
          </p>
          <p className="mt-1.5 text-2xl font-bold text-blue-600">
            {inTransitCount} Pengiriman
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Menunggu konfirmasi terima di tujuan
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            Transfer Selesai
          </p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600">
            {receivedCount} Mutasi
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Stok lokasi tujuan telah bertambah
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            Nilai Barang Termutasi
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatRupiah(totalValueTransferred)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tercatat di Jurnal Umum otomatis
          </p>
        </div>
      </div>

      {/* Tabel Posisi Stok per Lokasi Penyimpanan */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Posisi Stok per Lokasi Penyimpanan (Real-time)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribusi stok bahan baku antara Gudang Utama, Dapur Utama, dan
              Bar Minuman
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                <th className="px-3 py-3">Bahan Baku</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3 text-right">Gudang Utama</th>
                <th className="px-3 py-3 text-right">Dapur Utama</th>
                <th className="px-3 py-3 text-right">Bar Minuman</th>
                <th className="px-3 py-3 text-right">Total Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {initialData.ingredients.map((ing) => {
                const st = ing.storage_stock ?? {
                  gudang: ing.current_stock,
                  dapur: 0,
                  bar: 0,
                };
                return (
                  <tr key={ing.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {ing.name}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 font-medium">
                        {ing.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {Number(st.gudang ?? 0).toLocaleString("id-ID")}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        {ing.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {Number(st.dapur ?? 0).toLocaleString("id-ID")}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        {ing.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-purple-700 dark:text-purple-400">
                      {Number(st.bar ?? 0).toLocaleString("id-ID")}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        {ing.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {ing.current_stock.toLocaleString("id-ID")} {ing.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daftar Riwayat & Approval Transfer Stok */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Daftar Dokumen Transfer / Mutasi Stok
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Klik Approve untuk mengirim barang (In-Transit), lalu klik Terima
            Barang saat tiba di lokasi tujuan.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                <th className="px-3 py-3">No. Transfer</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Asal → Tujuan</th>
                <th className="px-3 py-3">Bahan & Qty</th>
                <th className="px-3 py-3 text-right">Nilai Mutasi</th>
                <th className="px-3 py-3">Pengirim / Penerima</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {initialData.transfers.map((trf) => (
                <tr key={trf.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-3 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                    {trf.transfer_no}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {trf.transfer_date}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-700 dark:text-slate-300">
                        {trf.from_location}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="rounded bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-blue-700 dark:text-blue-300">
                        {trf.to_location}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {trf.ingredient_name_snapshot}{" "}
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      ({trf.qty} {trf.unit})
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatRupiah(trf.total_value)}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                    <div>Kirim: {trf.sender_name}</div>
                    {trf.receiver_name && (
                      <div className="text-emerald-700 dark:text-emerald-400">
                        Terima: {trf.receiver_name}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {trf.status === "pending" && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        Pending Approval
                      </span>
                    )}
                    {trf.status === "in_transit" && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:text-blue-300">
                        In-Transit
                      </span>
                    )}
                    {trf.status === "received" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        Diterima
                      </span>
                    )}
                    {trf.status === "cancelled" && (
                      <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                        Dibatalkan
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {trf.status === "pending" && canApprove && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleApprove(trf.id)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-600 disabled:opacity-50"
                      >
                        Approve Kirim
                      </button>
                    )}
                    {trf.status === "pending" && !canApprove && (
                      <span className="text-xs text-slate-400">
                        Menunggu Owner/Kasir
                      </span>
                    )}
                    {trf.status === "in_transit" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleReceive(trf.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Terima Barang
                      </button>
                    )}
                    {trf.status === "received" && (
                      <span className="text-xs font-semibold text-emerald-600">
                        Selesai
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Transfer Stok */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Buat Request Transfer / Mutasi Stok
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lokasi Asal
                  </label>
                  <select
                    value={fromLocation}
                    onChange={(e) =>
                      setFromLocation(
                        e.target.value as (typeof LOCATIONS)[number]
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lokasi Tujuan
                  </label>
                  <select
                    value={toLocation}
                    onChange={(e) =>
                      setToLocation(
                        e.target.value as (typeof LOCATIONS)[number]
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pilih Bahan Baku
                </label>
                <select
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  {initialData.ingredients.map((ing) => {
                    const st = ing.storage_stock ?? {
                      gudang: ing.current_stock,
                      dapur: 0,
                      bar: 0,
                    };
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} — Gudang: {st.gudang ?? 0} {ing.unit} |
                        Dapur: {st.dapur ?? 0} {ing.unit} | Bar: {st.bar ?? 0}{" "}
                        {ing.unit}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kuantitas Transfer ({selectedIngredient?.unit ?? "unit"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Estimasi Nilai Mutasi
                  </label>
                  <div className="flex h-10 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
                    {formatRupiah(
                      Math.round(
                        (Number(qty) || 0) *
                          (selectedIngredient?.unit_cost ?? 0)
                      )
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Catatan Mutasi (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Persiapan shift sore dapur utama"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Kirim Request Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

