"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Edit3,
  FileText,
  Image as ImageIcon,
  MapPin,
  Palette,
  Phone,
  Plus,
  RotateCcw,
  Settings,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createOutletAction,
  resetOutletDemoTransactionsAction,
  switchActiveOutletAction,
  updateOutletCustomizationAction,
  type OutletView,
} from "@/server/outlets";

const COLOR_PRESETS = [
  { name: "ESB Blue", hex: "#1E88E5" },
  { name: "Denim Blue", hex: "#3B7097" },
  { name: "Emerald Cafe", hex: "#059669" },
  { name: "Amber Bistro", hex: "#D97706" },
  { name: "Rose Bakery", hex: "#E11D48" },
  { name: "Violet Resto", hex: "#7C3AED" },
  { name: "Teal Lounge", hex: "#0D9488" },
  { name: "Dark Modern", hex: "#1E293B" },
];

interface OutletManagerProps {
  initialOutlets: OutletView[];
  activeOutletId: string;
}

export function OutletManager({
  initialOutlets,
  activeOutletId,
}: OutletManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [outlets, setOutlets] = useState(initialOutlets);
  const [currentActiveId, setCurrentActiveId] = useState(activeOutletId);

  React.useEffect(() => {
    setOutlets(initialOutlets);
  }, [initialOutlets]);

  React.useEffect(() => {
    setCurrentActiveId(activeOutletId);
  }, [activeOutletId]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDescription, setNewDescription] = useState("Kafe & Resto Modern");
  const [newLogoUrl, setNewLogoUrl] = useState("/logo-1621group-stacked.png");
  const [newThemeColor, setNewThemeColor] = useState("#1E88E5");

  const [editingOutlet, setEditingOutlet] = useState<OutletView | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const handleCreateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createOutletAction({
        name: newName,
        address: newAddress,
        phone: newPhone,
        description: newDescription,
        logoUrl: newLogoUrl,
        themeColor: newThemeColor,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      if (res.outlet) {
        setOutlets((prev) => [...prev, res.outlet!]);
      }
      setShowAddForm(false);
      setNewName("");
      setNewAddress("");
      setNewPhone("");
      router.refresh();
    });
  };

  const handleSwitchOutlet = (outletId: string) => {
    setCurrentActiveId(outletId);
    startTransition(async () => {
      const res = await switchActiveOutletAction(outletId);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        setCurrentActiveId(activeOutletId);
        toast.error(res.message);
      }
    });
  };

  const handleUpdateCustomization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet) return;

    const updatedSnapshot = { ...editingOutlet };
    setOutlets((prev) =>
      prev.map((o) => (o.id === updatedSnapshot.id ? updatedSnapshot : o))
    );
    setEditingOutlet(null);

    startTransition(async () => {
      const res = await updateOutletCustomizationAction({
        id: updatedSnapshot.id,
        name: updatedSnapshot.name,
        address: updatedSnapshot.address ?? "",
        phone: updatedSnapshot.phone ?? "",
        description: updatedSnapshot.description ?? "",
        logoUrl: updatedSnapshot.logoUrl,
        themeColor: updatedSnapshot.themeColor,
      });

      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        setOutlets(initialOutlets);
        toast.error(res.message);
      }
    });
  };

  const handleResetDemoData = (outletId: string) => {
    setConfirmResetId(null);
    startTransition(async () => {
      const res = await resetOutletDemoTransactionsAction(outletId);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="space-y-5 bg-[#F4F7FA] dark:bg-slate-950 -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800 dark:text-slate-100">
      {/* Breadcrumb & Header ala ESB POSLite */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[12px] text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-[#1E88E5]">
              Beranda
            </Link>{" "}
            &gt; <span className="text-slate-600 dark:text-slate-300">Pengaturan Cabang / Kedai</span>
          </div>
          <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100 mt-1">
            Pengaturan Cabang / Kedai (Multi-Outlet)
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola kedai aktif (LATTESPACE, SAIKO RAMEN), profil struk, pajak, serta reset data simulasi demo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/pengaturan"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Pajak, Service &amp; QRIS Kedai</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1E88E5] px-4 text-[13px] font-semibold text-white shadow-2xs hover:bg-[#1976D2] transition cursor-pointer"
          >
            {showAddForm ? (
              <>
                <X className="h-4 w-4" />
                <span>Tutup Form</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Tambah Kedai / Cabang</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Form Tambah Cabang Baru */}
      {showAddForm && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
                Tambah Kedai / Cabang Baru
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Otomatis membuat profil kedai baru lengkap dengan 10 meja QR siap pakai.
              </p>
            </div>
            <span className="rounded-md bg-[#EBF5FF] text-[#1E88E5] px-3 py-1 text-[12px] font-semibold">
              Multi-Outlet ESB
            </span>
          </div>

          <form onSubmit={handleCreateOutlet} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>Nama Kedai / Cabang *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: LATTESPACE atau SAIKO RAMEN"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>Nomor Telepon Kedai</span>
                </label>
                <input
                  type="text"
                  placeholder="0812-3456-7890"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>Alamat Lengkap Kedai (Tampil di Struk)</span>
                </label>
                <input
                  type="text"
                  placeholder="Jl. Pandanaran No. 123, Boyolali"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span>Catatan Kaki Struk / Konsep Kedai</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Terima kasih telah berkunjung ke Latte Space!"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <ImageIcon className="h-4 w-4 text-slate-400" />
                  <span>Path / URL Logo Kedai</span>
                </label>
                <input
                  type="text"
                  value={newLogoUrl}
                  onChange={(e) => setNewLogoUrl(e.target.value)}
                  placeholder="/logo-1621group-stacked.png"
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  <Palette className="h-4 w-4 text-slate-400" />
                  <span>Warna Identitas Kedai</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setNewThemeColor(color.hex)}
                      title={color.name}
                      className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                        newThemeColor === color.hex
                          ? "scale-110 border-slate-900 ring-2 ring-sky-300"
                          : "border-white hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newThemeColor}
                    onChange={(e) => setNewThemeColor(e.target.value)}
                    className="h-7 w-8 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
                    title="Pilih warna kustom"
                  />
                  <span className="text-[12px] font-mono text-slate-500 font-semibold">
                    {newThemeColor}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-5 text-[13px] font-semibold text-white shadow-2xs hover:bg-[#1976D2] transition cursor-pointer disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                <span>{isPending ? "Menyimpan..." : "Simpan Kedai Baru"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabel Daftar Kedai / Cabang Bergaya ESB POSLite */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
              Daftar Kedai Terdaftar ({outlets.length} Cabang)
            </h2>
            <p className="text-[13px] text-slate-500">
              Klik tombol <strong>Pilih Kedai</strong> untuk beralih cabang secara instan tanpa muat ulang halaman.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] dark:bg-slate-800/80 text-[13px] font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <th className="px-5 py-3.5">Nama Kedai / Cabang</th>
                <th className="px-4 py-3.5">Alamat &amp; Kontak</th>
                <th className="px-4 py-3.5">Pajak &amp; Service</th>
                <th className="px-4 py-3.5 text-center">Status Sesi</th>
                <th className="px-5 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[14px]">
              {outlets.map((outlet) => {
                const isActive = outlet.id === currentActiveId;
                return (
                  <tr
                    key={outlet.id}
                    className={`transition-colors ${
                      isActive
                        ? "bg-[#EBF5FF]/40 dark:bg-sky-950/20"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center p-1 shrink-0">
                          <Image
                            src="/logo-1621group-stacked.png"
                            alt={outlet.name}
                            width={36}
                            height={24}
                            className="h-full w-auto object-contain"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {outlet.name}
                          </div>
                          <div className="text-[12px] text-slate-500">
                            {outlet.description || "1621 Group Outlet"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-[13px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{outlet.address || "Belum diatur"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[12px] text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{outlet.phone || "-"}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-[13px] text-slate-600 dark:text-slate-300">
                      <div>
                        PB1:{" "}
                        <span className="font-semibold">
                          {outlet.taxEnabled && outlet.taxPercent
                            ? `${outlet.taxPercent}%`
                            : "Nonaktif"}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-500 mt-0.5">
                        Service:{" "}
                        <span className="font-semibold">
                          {outlet.serviceEnabled && outlet.servicePercent
                            ? `${outlet.servicePercent}%`
                            : "Nonaktif"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                          <Store className="h-3.5 w-3.5" />
                          <span>Kedai Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-600">
                          Siaga
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!isActive && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSwitchOutlet(outlet.id)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3.5 text-[12px] font-semibold text-white hover:bg-[#1976D2] transition cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Pilih Kedai</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingOutlet({ ...outlet })}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                          <span>Ubah Profil</span>
                        </button>

                        {confirmResetId === outlet.id ? (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleResetDemoData(outlet.id)}
                              className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 cursor-pointer"
                            >
                              Ya, Kosongkan Omzet
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmResetId(null)}
                              className="px-1.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmResetId(outlet.id)}
                            title="Kosongkan transaksi demo cabang ini ke Rp 0"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset Transaksi</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Profil Kedai / Cabang */}
      {editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
                  Ubah Profil &amp; Identitas Kedai
                </h3>
                <p className="text-[12px] text-slate-500">
                  Perubahan nama, alamat, dan kontak langsung diterapkan pada cetakan struk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOutlet(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomization} className="space-y-3.5">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nama Kedai / Cabang
                </label>
                <input
                  type="text"
                  required
                  value={editingOutlet.name}
                  onChange={(e) =>
                    setEditingOutlet({ ...editingOutlet, name: e.target.value })
                  }
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  value={editingOutlet.address ?? ""}
                  onChange={(e) =>
                    setEditingOutlet({
                      ...editingOutlet,
                      address: e.target.value,
                    })
                  }
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  value={editingOutlet.phone ?? ""}
                  onChange={(e) =>
                    setEditingOutlet({
                      ...editingOutlet,
                      phone: e.target.value,
                    })
                  }
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Catatan Kaki Struk / Konsep Kedai
                </label>
                <input
                  type="text"
                  value={editingOutlet.description ?? ""}
                  onChange={(e) =>
                    setEditingOutlet({
                      ...editingOutlet,
                      description: e.target.value,
                    })
                  }
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-[14px] text-slate-800 dark:text-slate-100 focus:border-[#1E88E5] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOutlet(null)}
                  className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-lg bg-[#1E88E5] text-[13px] font-semibold text-white hover:bg-[#1976D2] transition cursor-pointer disabled:opacity-60"
                >
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
