"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah, roundRupiah } from "@/lib/money";
import {
  approveOrRejectStockOpnameAction,
  submitBlindStockOpnameAction,
  type StockOpnamePageData,
} from "@/server/inventory";

export function OpnameManager({
  initialData,
}: {
  initialData: StockOpnamePageData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [signature, setSignature] = React.useState("Andi Pratama");
  const [notes, setNotes] = React.useState("");

  const totalItems = initialData.ingredients.length;
  const filledCount = initialData.ingredients.filter(
    (ing) => Boolean(counts[ing.id]?.trim())
  ).length;
  const progressPct =
    totalItems > 0 ? Math.round((filledCount / totalItems) * 100) : 0;

  function handleCountChange(id: string, value: string) {
    setCounts((prev) => ({
      ...prev,
      [id]: value,
    }));
  }

  function handleSaveDraft() {
    toast.success(
      `Draft Stock Opname (${filledCount}/${totalItems} bahan) berhasil disimpan sementara.`
    );
  }

  function handleSubmitOpname() {
    if (filledCount < totalItems) {
      toast.error(
        `Masih ada ${totalItems - filledCount} bahan baku yang belum dihitung fisik!`
      );
      return;
    }

    startTransition(async () => {
      const payload = initialData.ingredients.map((ing) => ({
        ingredientId: ing.id,
        physicalQty: Number(counts[ing.id] ?? 0),
      }));

      const res = await submitBlindStockOpnameAction({
        counts: payload,
        notes,
        digitalSignature: signature,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setCounts({});
      router.refresh();
    });
  }

  function handleDecision(opnameId: string, decision: "approved" | "rejected") {
    startTransition(async () => {
      const res = await approveOrRejectStockOpnameAction({
        opnameId,
        decision,
      });
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
      {/* Amber Gradient Header (Blind Count Mode) */}
      <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-sm">
        <h3 className="text-lg font-extrabold">
          🔍 Stock Opname — Blind Count Mode
        </h3>
        <p className="mt-0.5 text-xs text-amber-50 sm:text-sm">
          Anda TIDAK melihat stok sistem sebelum mengisi. Isi sesuai hitungan
          fisik aktual di gudang/dapur.
        </p>
        <div className="mt-3 text-xs font-semibold">
          Progress Hitung Fisik:{" "}
          <strong>
            {filledCount}/{totalItems}
          </strong>{" "}
          ({progressPct}%)
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabel Input Blind Count */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                <th className="px-3 py-2.5">Bahan Baku</th>
                <th className="px-3 py-2.5">Kategori</th>
                <th className="px-3 py-2.5">Satuan</th>
                <th className="px-3 py-2.5">Qty Fisik (Blind Input)</th>
                <th className="px-3 py-2.5">Selisih vs Sistem</th>
                <th className="px-3 py-2.5 text-right">Nilai Rupiah Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialData.ingredients.map((ing) => {
                const rawVal = counts[ing.id];
                const hasVal = rawVal !== undefined && rawVal.trim() !== "";
                const phys = hasVal ? Number(rawVal) : null;
                const selisih =
                  phys !== null
                    ? Number((phys - ing.system_stock).toFixed(2))
                    : null;
                const nilai =
                  selisih !== null
                    ? roundRupiah(selisih * ing.unit_cost)
                    : null;

                return (
                  <tr key={ing.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">
                      {ing.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {ing.category}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                      {ing.unit}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={rawVal ?? ""}
                        onChange={(e) =>
                          handleCountChange(ing.id, e.target.value)
                        }
                        placeholder="?"
                        className="w-28 rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-center text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {selisih === null ? (
                        <span className="text-slate-400">—</span>
                      ) : Math.abs(selisih) < 0.05 ? (
                        <span className="inline-block rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          ✅ Sesuai
                        </span>
                      ) : selisih < 0 ? (
                        <span className="inline-block rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                          ▼ {selisih} {ing.unit} (kurang)
                        </span>
                      ) : (
                        <span className="inline-block rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          ▲ +{selisih} {ing.unit} (lebih)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold">
                      {nilai === null ? (
                        "—"
                      ) : nilai < 0 ? (
                        <span className="text-red-600">
                          - {formatRupiah(Math.abs(nilai))}
                        </span>
                      ) : nilai > 0 ? (
                        <span className="text-amber-600">
                          + {formatRupiah(nilai)}
                        </span>
                      ) : (
                        <span className="text-emerald-700">Rp 0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Submit Opname */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              📸 TTD Digital / Nama Pemeriksa
            </label>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Nama terang"
              className="w-52"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Catatan Opname (Opsional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Opname tutup shift malam"
              className="w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isPending}
          >
            💾 Simpan Draft
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSubmitOpname}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? "Mengirim..." : "✅ Submit Stock Opname"}
          </Button>
        </div>
      </div>

      {/* Daftar Riwayat & Approval Opname (Owner) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          📋 Riwayat &amp; Approval Stock Opname
        </h3>
        {initialData.opnames.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            Belum ada dokumen Stock Opname yang disubmit.
          </p>
        ) : (
          <div className="space-y-3">
            {initialData.opnames.map((opn) => (
              <div
                key={opn.id}
                className={`rounded-xl border p-4 ${
                  opn.status === "waiting_approval"
                    ? "border-amber-300 bg-amber-50/50"
                    : opn.status === "approved"
                      ? "border-emerald-200 bg-emerald-50/30"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        {opn.opname_no}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          opn.status === "waiting_approval"
                            ? "bg-amber-100 text-amber-800"
                            : opn.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {opn.status === "waiting_approval"
                          ? "Menunggu Approval Owner"
                          : opn.status === "approved"
                            ? "Approved & Stok Disesuaikan"
                            : "Ditolak"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Tanggal: {opn.opname_date} • Pemeriksa:{" "}
                      <strong>{opn.submitted_by_name}</strong> (TTD:{" "}
                      {opn.digital_signature})
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      Total Selisih Nilai
                    </div>
                    <div
                      className={`text-base font-extrabold ${
                        opn.total_variance_amount < 0
                          ? "text-red-600"
                          : opn.total_variance_amount > 0
                            ? "text-amber-600"
                            : "text-emerald-700"
                      }`}
                    >
                      {opn.total_variance_amount < 0
                        ? `- ${formatRupiah(Math.abs(opn.total_variance_amount))}`
                        : formatRupiah(opn.total_variance_amount)}
                    </div>
                  </div>
                </div>

                {opn.status === "waiting_approval" &&
                initialData.currentRole === "owner" ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDecision(opn.id, "approved")}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      ✓ Approve &amp; Sesuaikan Stok + Jurnal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleDecision(opn.id, "rejected")}
                    >
                      ✖ Tolak
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

