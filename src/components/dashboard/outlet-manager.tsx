"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createOutletAction,
  switchActiveOutletAction,
  updateOutletCustomizationAction,
  type OutletView,
} from "@/server/outlets";

const COLOR_PRESETS = [
  { name: "Denim Blue", hex: "#3B7097" },
  { name: "Ocean Sky", hex: "#0284C7" },
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

  // Form State: Tambah Cabang Baru
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDescription, setNewDescription] = useState("Kafe & Resto Modern");
  const [newLogoUrl, setNewLogoUrl] = useState("/logo-1621.png");
  const [newThemeColor, setNewThemeColor] = useState("#3B7097");

  // Edit Modal State
  const [editingOutlet, setEditingOutlet] = useState<OutletView | null>(null);

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
      setShowAddForm(false);
      setNewName("");
      setNewAddress("");
      setNewPhone("");
      router.refresh();
    });
  };

  const handleSwitchOutlet = (outletId: string) => {
    startTransition(async () => {
      const res = await switchActiveOutletAction(outletId);
      if (res.ok) {
        setCurrentActiveId(outletId);
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleUpdateCustomization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet) return;

    startTransition(async () => {
      const res = await updateOutletCustomizationAction({
        id: editingOutlet.id,
        name: editingOutlet.name,
        address: editingOutlet.address ?? "",
        phone: editingOutlet.phone ?? "",
        description: editingOutlet.description ?? "",
        logoUrl: editingOutlet.logoUrl,
        themeColor: editingOutlet.themeColor,
      });

      if (res.ok) {
        toast.success(res.message);
        setOutlets((prev) =>
          prev.map((o) => (o.id === editingOutlet.id ? editingOutlet : o))
        );
        setEditingOutlet(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="space-y-6 bg-[#F4F6F9] -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-2xs text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-sky-600">
              Dashboard
            </Link>{" "}
            &gt; <span className="text-slate-600">Pengaturan Cabang</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mt-1 tracking-tight">
            Pengaturan Cabang &amp; Kustomisasi Tampilan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola multi-outlet, tambah cabang baru, sesuaikan logo dan warna tema per cabang.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0369a1] transition cursor-pointer"
          >
            <span>{showAddForm ? "✕ Tutup Form" : "+ Tambah Cabang Baru"}</span>
          </button>
        </div>
      </div>

      {/* Form Tambah Cabang Baru (Collapsible) */}
      {showAddForm && (
        <div className="rounded-2xl border border-sky-200 bg-white p-5 md:p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">
              Formulir Tambah Cabang / Outlet Baru
            </h3>
            <p className="text-2xs text-slate-500">
              Sistem akan otomatis menginisialisasi 10 meja awal dengan QR token unik untuk cabang ini.
            </p>
          </div>

          <form onSubmit={handleCreateOutlet} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Nama Cabang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 1621F&B - Boyolali"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Nomor Telepon Cabang
                </label>
                <input
                  type="text"
                  placeholder="0812-3456-7890"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Jl. Pandanaran No. 123, Boyolali"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Deskripsi / Tagline Cabang
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kafe & Resto Modern Boyolali"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  URL / Path Logo Cabang
                </label>
                <input
                  type="text"
                  value={newLogoUrl}
                  onChange={(e) => setNewLogoUrl(e.target.value)}
                  placeholder="/logo-1621.png"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Warna Tema Cabang
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setNewThemeColor(color.hex)}
                      title={color.name}
                      className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                        newThemeColor === color.hex
                          ? "scale-115 border-slate-900 shadow-xs ring-2 ring-sky-300"
                          : "border-white hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newThemeColor}
                    onChange={(e) => setNewThemeColor(e.target.value)}
                    className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                    title="Pilih warna kustom"
                  />
                  <span className="text-2xs font-mono text-slate-500">
                    {newThemeColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-xs"
                  style={{ backgroundColor: newThemeColor }}
                >
                  🏢
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {newName || "Nama Cabang Baru"}
                  </div>
                  <div className="text-2xs text-slate-500">
                    {newAddress || "Alamat Cabang"} &bull; {newPhone || "No. Telp"}
                  </div>
                </div>
              </div>
              <div
                className="rounded-lg px-3 py-1 text-2xs font-bold text-white shadow-xs"
                style={{ backgroundColor: newThemeColor }}
              >
                Preview Tag
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[#F58220] px-5 py-2 text-xs font-bold text-white hover:bg-[#e07519] transition shadow-xs cursor-pointer"
              >
                {isPending ? "Menyimpan..." : "Simpan Cabang Baru"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar Cabang / Outlets Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {outlets.map((outlet) => {
          const isActive = outlet.id === currentActiveId;
          return (
            <div
              key={outlet.id}
              className={`rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between transition-all ${
                isActive
                  ? "border-[#0284C7] ring-2 ring-sky-100"
                  : "border-slate-200/90 hover:border-slate-300"
              }`}
            >
              <div>
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold shadow-xs shrink-0"
                      style={{ backgroundColor: outlet.themeColor }}
                    >
                      <Image
                        src={outlet.logoUrl || "/logo-1621.png"}
                        alt={outlet.name}
                        width={32}
                        height={32}
                        className="h-7 w-7 object-contain drop-shadow-xs"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-tight">
                        {outlet.name}
                      </h4>
                      <p className="text-2xs text-slate-400 mt-0.5">
                        {outlet.description || "Kafe & Resto 1621F&B"}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-2xs font-bold text-emerald-700 shrink-0">
                      Aktif
                    </span>
                  )}
                </div>

                {/* Detail Info */}
                <div className="mt-4 space-y-1.5 text-2xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">📍</span>
                    <span className="truncate">
                      {outlet.address || "Belum ada alamat"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">📞</span>
                    <span>{outlet.phone || "Belum ada telepon"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">🎨</span>
                    <span>Warna Tema:</span>
                    <span
                      className="h-3 w-3 rounded-full border border-slate-200 inline-block shrink-0"
                      style={{ backgroundColor: outlet.themeColor }}
                    />
                    <span className="font-mono text-[10px] text-slate-500">
                      {outlet.themeColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOutlet({ ...outlet })}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Edit Tampilan
                </button>

                {!isActive ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSwitchOutlet(outlet.id)}
                    className="flex-1 rounded-lg bg-[#0284C7] py-2 text-xs font-bold text-white hover:bg-[#0369a1] transition shadow-xs cursor-pointer"
                  >
                    Gunakan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex-1 rounded-lg bg-emerald-50 py-2 text-xs font-bold text-emerald-700 border border-emerald-200 cursor-default"
                  >
                    Sedang Dipakai
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Edit Tampilan & Logo Cabang */}
      {editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">
                Edit Tampilan &amp; Identitas Cabang
              </h3>
              <button
                type="button"
                onClick={() => setEditingOutlet(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCustomization} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Nama Cabang
                </label>
                <input
                  type="text"
                  required
                  value={editingOutlet.name}
                  onChange={(e) =>
                    setEditingOutlet({ ...editingOutlet, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Alamat
                </label>
                <input
                  type="text"
                  value={editingOutlet.address ?? ""}
                  onChange={(e) =>
                    setEditingOutlet({ ...editingOutlet, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  value={editingOutlet.phone ?? ""}
                  onChange={(e) =>
                    setEditingOutlet({ ...editingOutlet, phone: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Path / URL Logo
                </label>
                <input
                  type="text"
                  value={editingOutlet.logoUrl}
                  onChange={(e) =>
                    setEditingOutlet({ ...editingOutlet, logoUrl: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#0284C7] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 mb-1">
                  Pilihan Warna Tema Cabang
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() =>
                        setEditingOutlet({ ...editingOutlet, themeColor: color.hex })
                      }
                      title={color.name}
                      className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                        editingOutlet.themeColor === color.hex
                          ? "scale-115 border-slate-900 shadow-xs ring-2 ring-sky-300"
                          : "border-white hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={editingOutlet.themeColor}
                    onChange={(e) =>
                      setEditingOutlet({ ...editingOutlet, themeColor: e.target.value })
                    }
                    className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                  />
                  <span className="text-2xs font-mono text-slate-500">
                    {editingOutlet.themeColor}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOutlet(null)}
                  className="rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-[#F58220] py-2.5 text-xs font-bold text-white hover:bg-[#e07519] transition shadow-xs cursor-pointer"
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
