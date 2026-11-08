"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { formatDateTimeWIB } from "@/lib/datetime";
import { formatRupiah } from "@/lib/money";
import {
  verifyAuditChainNowAction,
  type AuditChainVerificationStatus,
  type AuditLogRowView,
  type AuditTrailDashboardData,
} from "@/server/audit-trail";

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const raw =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function AuditTrailExplorer({
  initialData,
  activePeriod,
}: {
  initialData: AuditTrailDashboardData;
  activePeriod: "today" | "7d" | "30d" | "all";
}) {
  const [viewMode, setViewMode] = useState<"logs" | "order_timeline">("logs");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedLogId, setSelectedLogId] = useState<number | null>(
    initialData.logs[0]?.id ?? null
  );
  const [selectedTimelineOrderId, setSelectedTimelineOrderId] = useState<
    string | null
  >(initialData.orderTimelines[0]?.orderId ?? null);

  const [chainStatus, setChainStatus] = useState<AuditChainVerificationStatus>(
    initialData.chainVerification
  );
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of initialData.logs) {
      if (l.entity) set.add(l.entity);
    }
    return Array.from(set).sort();
  }, [initialData.logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialData.logs.filter((log) => {
      if (roleFilter !== "all" && log.role !== roleFilter) {
        return false;
      }
      if (entityFilter !== "all" && log.entity !== entityFilter) {
        return false;
      }
      if (q) {
        const hay = [
          log.action,
          log.entity,
          log.orderNo ?? "",
          log.actorName,
          log.reason ?? "",
          log.entityId ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialData.logs, roleFilter, entityFilter, searchQuery]);

  const selectedLog: AuditLogRowView | null = useMemo(() => {
    if (selectedLogId !== null) {
      const found = filteredLogs.find((l) => l.id === selectedLogId);
      if (found) return found;
    }
    return filteredLogs[0] ?? null;
  }, [filteredLogs, selectedLogId]);

  const filteredTimelines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return initialData.orderTimelines;
    return initialData.orderTimelines.filter(
      (tl) =>
        tl.orderNo.toLowerCase().includes(q) ||
        tl.tableName.toLowerCase().includes(q) ||
        tl.orderId.toLowerCase().includes(q)
    );
  }, [initialData.orderTimelines, searchQuery]);

  const activeTimeline = useMemo(() => {
    if (selectedTimelineOrderId) {
      const found = filteredTimelines.find(
        (t) => t.orderId === selectedTimelineOrderId
      );
      if (found) return found;
    }
    return filteredTimelines[0] ?? null;
  }, [filteredTimelines, selectedTimelineOrderId]);

  async function handleVerifyChainNow() {
    setIsVerifyingChain(true);
    setVerifyNotice(null);
    try {
      const res = await verifyAuditChainNowAction();
      if (res.verification) {
        setChainStatus(res.verification);
      }
      setVerifyNotice(res.message);
    } finally {
      setIsVerifyingChain(false);
    }
  }

  function handleExportCsv() {
    const headers = [
      "ID",
      "Waktu (WIB)",
      "Pelaku",
      "Role",
      "Aksi",
      "Entitas",
      "No Order",
      "ID Objek",
      "Alasan",
      "IP",
      "Perangkat",
      "Nilai Sebelum (Before)",
      "Nilai Sesudah (After)",
      "Prev Hash",
      "Hash SHA-256",
    ];

    const rows = filteredLogs.map((l) => [
      escapeCsvCell(l.id),
      escapeCsvCell(formatDateTimeWIB(l.createdAt)),
      escapeCsvCell(l.actorName),
      escapeCsvCell(l.role),
      escapeCsvCell(l.action),
      escapeCsvCell(l.entity),
      escapeCsvCell(l.orderNo ?? ""),
      escapeCsvCell(l.entityId ?? ""),
      escapeCsvCell(l.reason ?? ""),
      escapeCsvCell(l.ip ?? ""),
      escapeCsvCell(l.device ?? ""),
      escapeCsvCell(l.before),
      escapeCsvCell(l.after),
      escapeCsvCell(l.prevHash),
      escapeCsvCell(l.hash),
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.join(","))].join(
        "\r\n"
      );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jejak-audit-1621fnb-${activePeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Panel Status Keutuhan Rantai Hash SHA-256 */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4 shadow-sm ${
          chainStatus.isValid
            ? "border-emerald-500 bg-emerald-50/70 text-emerald-950"
            : "border-red-600 bg-red-50 text-red-950"
        }`}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={chainStatus.isValid ? "success" : "destructive"}>
              {chainStatus.isValid
                ? "RANTAI HASH SHA-256 UTUH & VALID"
                : "PERINGATAN: RANTAI HASH RUSAK"}
            </Badge>
            <span className="text-sm font-extrabold">
              {chainStatus.checkedRows} Baris Audit Diperiksa (Append-Only)
            </span>
          </div>
          <p className="mt-1 text-xs">
            {chainStatus.errorMessage} Tabel{" "}
            <code className="font-mono font-bold">audit_logs</code> dilindungi
            trigger database terhadap UPDATE &amp; DELETE, bahkan oleh Owner.
          </p>
          {verifyNotice && (
            <p className="mt-1 text-xs font-bold underline">{verifyNotice}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isVerifyingChain}
            onClick={handleVerifyChainNow}
          >
            {isVerifyingChain
              ? "Memeriksa Hash..."
              : "Verifikasi Ulang Rantai Hash"}
          </Button>
          <Button type="button" size="sm" onClick={handleExportCsv}>
            Ekspor CSV ({filteredLogs.length} Baris)
          </Button>
        </div>
      </div>

      {/* Baris Mode Tampilan & Periode */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3.5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={viewMode === "logs" ? "default" : "outline"}
            onClick={() => setViewMode("logs")}
          >
            Semua Catatan Audit ({filteredLogs.length})
          </Button>
          <Button
            type="button"
            variant={viewMode === "order_timeline" ? "default" : "outline"}
            onClick={() => setViewMode("order_timeline")}
          >
            Riwayat Lengkap per Order ({filteredTimelines.length} Order)
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "today", label: "Hari Ini" },
              { key: "7d", label: "7 Hari" },
              { key: "30d", label: "30 Hari" },
              { key: "all", label: "Semua" },
            ] as const
          ).map((p) => (
            <Link key={p.key} href={`/dashboard/audit?period=${p.key}`}>
              <Button
                type="button"
                size="sm"
                variant={activePeriod === p.key ? "default" : "outline"}
              >
                {p.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Baris Filter Pelaku, Entitas, & Pencarian */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3.5">
        <select
          aria-label="Filter Role Pelaku"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="all">Semua Pelaku / Role</option>
          <option value="owner">Owner</option>
          <option value="cashier">Kasir (Cashier)</option>
          <option value="kitchen">Dapur (Kitchen)</option>
          <option value="waiter">Pelayan (Waiter)</option>
          <option value="customer">Pelanggan (Scan QR)</option>
          <option value="system">Sistem Otomatis</option>
        </select>

        <select
          aria-label="Filter Objek / Entitas"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="all">Semua Objek / Tabel</option>
          {entityOptions.map((ent) => (
            <option key={ent} value={ent}>
              {ent}
            </option>
          ))}
        </select>

        <Input
          type="search"
          placeholder="Cari nomor order (#...), aksi, pelaku, atau alasan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-60"
        />
      </div>

      {/* MODE 1: TABEL SEMUA CATATAN AUDIT & INSPEKTOR BEFORE/AFTER */}
      {viewMode === "logs" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Card>
              <CardContent className="p-0">
                {filteredLogs.length === 0 ? (
                  <div className="py-14 text-center text-sm text-zinc-500">
                    Tidak ada catatan audit yang cocok dengan filter.
                  </div>
                ) : (
                  <div className="max-h-[680px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 uppercase text-zinc-500">
                        <tr>
                          <th className="px-3 py-2.5">ID &amp; Waktu</th>
                          <th className="px-3 py-2.5">Pelaku</th>
                          <th className="px-3 py-2.5">Aksi &amp; Objek</th>
                          <th className="px-3 py-2.5">Order / Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredLogs.map((log) => {
                          const isSelected = selectedLog?.id === log.id;
                          return (
                            <tr
                              key={log.id}
                              onClick={() => setSelectedLogId(log.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-zinc-100 font-semibold"
                                  : "hover:bg-zinc-50"
                              }`}
                            >
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="font-mono font-bold text-zinc-900">
                                  #{log.id}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  {formatDateTimeWIB(log.createdAt)}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-semibold text-zinc-900">
                                  {log.actorName}
                                </div>
                                <Badge variant="outline" className="mt-0.5">
                                  {log.role}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-mono font-bold text-zinc-900">
                                  {log.action}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  Tabel: {log.entity}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {log.orderNo && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (log.orderId) {
                                        setSelectedTimelineOrderId(log.orderId);
                                        setViewMode("order_timeline");
                                      }
                                    }}
                                    className="font-mono font-bold text-emerald-700 underline"
                                  >
                                    Order #{log.orderNo}
                                  </button>
                                )}
                                {log.reason && (
                                  <div className="line-clamp-2 text-[11px] text-zinc-600">
                                    {log.reason}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel Inspektor Nilai Sebelum & Sesudah */}
          <div className="lg:col-span-5">
            {!selectedLog ? (
              <Card>
                <CardContent className="py-14 text-center text-sm text-zinc-500">
                  Pilih satu baris audit di sebelah kiri untuk memeriksa nilai
                  sebelum &amp; sesudah perubahan.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="border-b border-zinc-100 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="font-mono text-base">
                        Log #{selectedLog.id} — {selectedLog.action}
                      </CardTitle>
                      <CardDescription>
                        {formatDateTimeWIB(selectedLog.createdAt)} • Pelaku:{" "}
                        <strong>{selectedLog.actorName}</strong> (
                        {selectedLog.role})
                      </CardDescription>
                    </div>
                    {selectedLog.orderId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedTimelineOrderId(selectedLog.orderId);
                          setViewMode("order_timeline");
                        }}
                      >
                        Lihat Kronologi Order
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-4 text-xs">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                    <div>
                      <span className="text-zinc-500">Objek / Entitas:</span>
                      <p className="font-mono font-bold text-zinc-900">
                        {selectedLog.entity} ({selectedLog.entityId ?? "-"})
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500">IP &amp; Perangkat:</span>
                      <p className="truncate font-mono text-zinc-800">
                        {selectedLog.ip ?? "-"} • {selectedLog.device ?? "-"}
                      </p>
                    </div>
                  </div>

                  {selectedLog.reason && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-950">
                      <span className="font-bold">Alasan Tercatat:</span>{" "}
                      {selectedLog.reason}
                    </div>
                  )}

                  <div>
                    <p className="mb-1 font-bold text-zinc-700">
                      Nilai Sebelum Perubahan (Before):
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 font-mono text-[11px] text-zinc-100">
                      {selectedLog.before
                        ? JSON.stringify(selectedLog.before, null, 2)
                        : "null (Data baru / INSERT)"}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-zinc-700">
                      Nilai Sesudah Perubahan (After):
                    </p>
                    <pre className="max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 font-mono text-[11px] text-emerald-300">
                      {selectedLog.after
                        ? JSON.stringify(selectedLog.after, null, 2)
                        : "null"}
                    </pre>
                  </div>

                  <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-[10px] text-zinc-600">
                    <div className="truncate">
                      <strong>prev_hash:</strong> {selectedLog.prevHash}
                    </div>
                    <div className="truncate">
                      <strong>hash (SHA-256):</strong> {selectedLog.hash}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* MODE 2: RIWAYAT LENGKAP PER ORDER (TIMELINE KRONOLOGIS) */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-4">
            {filteredTimelines.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-zinc-500">
                  Tidak ada riwayat order yang ditemukan.
                </CardContent>
              </Card>
            ) : (
              filteredTimelines.map((tl) => {
                const isSelected = activeTimeline?.orderId === tl.orderId;
                return (
                  <button
                    key={tl.orderId}
                    type="button"
                    onClick={() => setSelectedTimelineOrderId(tl.orderId)}
                    className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-2 border-zinc-900 bg-zinc-50 shadow-sm"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-extrabold text-zinc-900">
                        #{tl.orderNo}
                      </span>
                      <Badge variant="outline">
                        {tl.events.length} Kejadian
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-zinc-700">
                      {tl.tableName} • {formatRupiah(tl.total)} • Status:{" "}
                      {tl.status.toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {formatDateTimeWIB(tl.createdAt)}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className="lg:col-span-8">
            {!activeTimeline ? (
              <Card>
                <CardContent className="py-14 text-center text-sm text-zinc-500">
                  Pilih salah satu order di sebelah kiri untuk melihat riwayat
                  audit lengkapnya dari awal hingga akhir.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="border-b border-zinc-100 pb-3">
                  <CardTitle>
                    Kronologi Lengkap Order #{activeTimeline.orderNo} (
                    {activeTimeline.tableName})
                  </CardTitle>
                  <CardDescription>
                    Total Tagihan: {formatRupiah(activeTimeline.total)} • Status
                    Saat Ini:{" "}
                    <strong>{activeTimeline.status.toUpperCase()}</strong> •{" "}
                    {activeTimeline.events.length} jejak audit terekam
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  <ol className="relative border-l-2 border-zinc-300 ml-3 space-y-5">
                    {activeTimeline.events.map((ev, idx) => (
                      <li key={ev.id} className="ml-5">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-extrabold text-zinc-900">
                                {ev.action}
                              </span>
                              <Badge variant="outline">{ev.role}</Badge>
                            </div>
                            <span className="font-mono text-[11px] text-zinc-500">
                              Log #{ev.id} • {formatDateTimeWIB(ev.createdAt)}
                            </span>
                          </div>

                          <p className="mt-1 font-semibold text-zinc-800">
                            Pelaku: {ev.actorName}{" "}
                            {ev.ip ? `(IP: ${ev.ip})` : ""}
                          </p>

                          {ev.reason && (
                            <p className="mt-1 rounded bg-amber-100/80 px-2 py-1 text-amber-950">
                              <strong>Alasan:</strong> {ev.reason}
                            </p>
                          )}

                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <span className="text-[11px] font-semibold text-zinc-500">
                                Sebelum (Before):
                              </span>
                              <pre className="mt-0.5 max-h-36 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200">
                                {ev.before
                                  ? JSON.stringify(ev.before, null, 2)
                                  : "null"}
                              </pre>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-zinc-500">
                                Sesudah (After):
                              </span>
                              <pre className="mt-0.5 max-h-36 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[10px] text-emerald-300">
                                {ev.after
                                  ? JSON.stringify(ev.after, null, 2)
                                  : "null"}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
