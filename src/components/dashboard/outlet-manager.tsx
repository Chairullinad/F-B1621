"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Edit3,
  ImagePlus,
  LogOut,
  MapPin,
  Palette,
  Phone,
  Plus,
  RotateCcw,
  Settings,
  Store,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { compressImageFileToDataUrl } from "@/lib/client-image";
import {
  OUTLET_CHART_FALLBACK_PALETTE,
  type OutletView,
} from "@/lib/outlets";
import {
  createOutletAction,
  leaveActiveOutletAction,
  resetOutletDemoTransactionsAction,
  switchActiveOutletAction,
  updateOutletCustomizationAction,
} from "@/server/outlets";

interface OutletManagerProps {
  initialOutlets: OutletView[];
  activeOutletId: string | null;
  initialEditOutletId?: string;
  initialOpenAdd?: boolean;
}

interface OutletFormState {
  name: string;
  address: string;
  phone: string;
  description: string;
  receiptFooter: string;
  logoUrl: string;
  themeColor: string;
}

const DEFAULT_LOGO_PATH = "/logo-1621group-stacked.png";

function makeEmptyFormState(indexOffset: number): OutletFormState {
  const paletteColor =
    OUTLET_CHART_FALLBACK_PALETTE[
      indexOffset % OUTLET_CHART_FALLBACK_PALETTE.length
    ] ?? "#0284C7";
  return {
    name: "",
    address: "",
    phone: "",
    description: "",
    receiptFooter: "Terima kasih atas kunjungan Anda!",
    logoUrl: DEFAULT_LOGO_PATH,
    themeColor: paletteColor,
  };
}

function makeEditFormState(outlet: OutletView): OutletFormState {
  return {
    name: outlet.name,
    address: outlet.address ?? "",
    phone: outlet.phone ?? "",
    description: outlet.description ?? "",
    receiptFooter: outlet.receiptFooter ?? "",
    logoUrl: outlet.logoUrl || DEFAULT_LOGO_PATH,
    themeColor: outlet.themeColor || "#0284C7",
  };
}

/**
 * Mengompres file logo ke Data URL maks 256x256 px sambil menjaga transparansi PNG.
 */
async function compressLogoToDataUrl(file: File): Promise<string> {
  return compressImageFileToDataUrl(file, {
    maxWidth: 256,
    maxHeight: 256,
    maxDataUrlLength: 360_000,
    preserveTransparency: true,
  });
}

interface OutletLogoAndColorFieldsProps {
  form: OutletFormState;
  onChange: (updater: (prev: OutletFormState) => OutletFormState) => void;
  idPrefix: string;
}

function OutletLogoAndColorFields({
  form,
  onChange,
  idPrefix,
}: OutletLogoAndColorFieldsProps) {
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, WebP, atau SVG).");
      return;
    }

    setIsProcessingLogo(true);
    try {
      const dataUrl = await compressLogoToDataUrl(file);
      onChange((prev) => ({ ...prev, logoUrl: dataUrl }));
      toast.success("Logo usaha berhasil dimuat. Jangan lupa simpan perubahan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses gambar logo."
      );
    } finally {
      setIsProcessingLogo(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Unggah & Preview Logo Usaha */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 overflow-hidden shadow-2xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.logoUrl || DEFAULT_LOGO_PATH}
              alt="Preview logo kios"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex-1 space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5 text-[#1E88E5]" />
              <span>Logo Usaha / Kios (PNG transparan disarankan)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={`${idPrefix}-logo-file`}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1E88E5] hover:bg-[#1976D2] px-3.5 text-xs font-semibold text-white cursor-pointer transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{isProcessingLogo ? "Memproses..." : "Upload File Logo"}</span>
              </label>
              <input
                id={`${idPrefix}-logo-file`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFilePick}
                className="sr-only"
              />
              {form.logoUrl !== DEFAULT_LOGO_PATH && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({ ...prev, logoUrl: DEFAULT_LOGO_PATH }))
                  }
                  className="inline-flex h-11 items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Pakai Logo Default
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-logo-url`}
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            Atau masukkan URL / path gambar logo secara manual:
          </label>
          <input
            id={`${idPrefix}-logo-url`}
            type="text"
            value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                logoUrl: e.target.value || DEFAULT_LOGO_PATH,
              }))
            }
            placeholder={
              form.logoUrl.startsWith("data:")
                ? "Menggunakan file gambar yang baru di-upload"
                : "/logo-1621group-stacked.png atau https://..."
            }
            className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-200 focus:border-[#1E88E5] focus:outline-none"
          />
        </div>
      </div>

      {/* Warna Identitas & Grafik Usaha */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-[#1E88E5]" />
          <span>Warna Identitas &amp; Garis Grafik Penjualan</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {OUTLET_CHART_FALLBACK_PALETTE.map((color) => {
            const isSelected =
              form.themeColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, themeColor: color }))}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition cursor-pointer ${
                  isSelected
                    ? "border-slate-900 dark:border-white scale-110 shadow-sm"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
                title={`Pilih warna ${color}`}
                aria-label={`Pilih warna ${color}`}
              >
                {isSelected && <Check className="h-4 w-4 text-white" />}
              </button>
            );
          })}

          <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-mono text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="color"
              value={form.themeColor}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, themeColor: e.target.value }))
              }
              className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span>{form.themeColor.toUpperCase()}</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export function OutletManager({
  initialOutlets,
  activeOutletId,
  initialEditOutletId,
  initialOpenAdd = false,
}: OutletManagerProps) {
  const router = useRouter();
  const [outlets, setOutlets] = useState<OutletView[]>(initialOutlets);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setOutlets(initialOutlets);
  }, [initialOutlets]);

  // Modal Tambah Kios Baru
  const [showAddForm, setShowAddForm] = useState(initialOpenAdd);
  const [addForm, setAddForm] = useState<OutletFormState>(() =>
    makeEmptyFormState(initialOutlets.length)
  );

  // Modal Edit Profil, Logo & Detail Kios
  const [editingOutlet, setEditingOutlet] = useState<OutletView | null>(() => {
    if (!initialEditOutletId) return null;
    return initialOutlets.find((o) => o.id === initialEditOutletId) ?? null;
  });
  const [editForm, setEditForm] = useState<OutletFormState>(() => {
    if (initialEditOutletId) {
      const target = initialOutlets.find((o) => o.id === initialEditOutletId);
      if (target) return makeEditFormState(target);
    }
    return makeEmptyFormState(0);
  });

  // Reset confirmation
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const openEditModal = (outlet: OutletView) => {
    setEditingOutlet(outlet);
    setEditForm(makeEditFormState(outlet));
  };

  const handleCreateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      toast.error("Nama usaha / kios wajib diisi.");
      return;
    }

    startTransition(async () => {
      const res = await createOutletAction({
        name: addForm.name,
        address: addForm.address,
        phone: addForm.phone,
        description: addForm.description,
        receiptFooter: addForm.receiptFooter,
        logoUrl: addForm.logoUrl,
        themeColor: addForm.themeColor,
      });

      if (res.ok) {
        toast.success(res.message);
        setShowAddForm(false);
        setAddForm(makeEmptyFormState(outlets.length + 1));
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleUpdateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet) return;

    startTransition(async () => {
      const res = await updateOutletCustomizationAction({
        id: editingOutlet.id,
        name: editForm.name,
        address: editForm.address,
        phone: editForm.phone,
        description: editForm.description,
        receiptFooter: editForm.receiptFooter,
        logoUrl: editForm.logoUrl,
        themeColor: editForm.themeColor,
      });

      if (res.ok) {
        toast.success(res.message);
        setEditingOutlet(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleEnterOutlet = (outletId: string) => {
    startTransition(async () => {
      const res = await switchActiveOutletAction(outletId);
      if (res.ok) {
        toast.success(res.message);
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleLeaveOutlet = () => {
    startTransition(async () => {
      const res = await leaveActiveOutletAction();
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
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
      {/* Breadcrumb & Header Setting Kios */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400 font-medium">
            <Link href="/dashboard" className="hover:text-[#1E88E5]">
              Dashboard Owner
            </Link>{" "}
            &gt;{" "}
            <span className="text-slate-600 dark:text-slate-300">
              Setting Kios &amp; Usaha
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
            Setting Kios &amp; Identitas Usaha
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola nama usaha, logo usaha, warna grafik penjualan, serta detail operasional setiap kios yang Anda miliki.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" />
            <span>Kembali ke Dashboard</span>
          </Link>

          <Link
            href={
              activeOutletId
                ? `/dashboard/landing-page?outletId=${encodeURIComponent(activeOutletId)}`
                : "/dashboard/landing-page"
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ImagePlus className="h-4 w-4 text-[#1E88E5]" />
            <span>Landing Page &amp; Banner</span>
          </Link>

          {activeOutletId && (
            <Link
              href="/dashboard/pengaturan"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Pajak, Service &amp; QRIS Kios</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1E88E5] px-4 text-xs font-semibold text-white shadow-2xs hover:bg-[#1976D2] transition cursor-pointer"
          >
            {showAddForm ? (
              <>
                <X className="h-4 w-4" />
                <span>Tutup Form</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Tambah Kios / Usaha Baru</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Form Tambah Kios / Usaha Baru */}
      {showAddForm && (
        <form
          onSubmit={handleCreateOutlet}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Buat Usaha / Kios Baru
            </h2>
            <span className="text-xs text-slate-400">
              Terhubung ke Dashboard &amp; Laporan Keuangan Owner
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Nama Usaha / Kios *
              </label>
              <input
                type="text"
                required
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Contoh: SAIKO RAMEN / KOPI 1621"
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Detail Usaha / Konsep Kuliner *
              </label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Contoh: Kedai Ramen & Donburi Jepang"
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Alamat Lokasi Kios
              </label>
              <input
                type="text"
                value={addForm.address}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Jl. Merdeka No. 12, Jakarta"
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Telepon / WhatsApp Kios
              </label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="0812-3456-7890"
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Pesan Footer Struk Pelanggan
              </label>
              <input
                type="text"
                value={addForm.receiptFooter}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    receiptFooter: e.target.value,
                  }))
                }
                placeholder="Terima kasih atas kunjungan Anda!"
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <OutletLogoAndColorFields
                form={addForm}
                onChange={setAddForm}
                idPrefix="add"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-11 rounded-xl bg-[#1E88E5] px-5 text-xs font-semibold text-white hover:bg-[#1976D2] disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan & Tambahkan Kios"}
            </button>
          </div>
        </form>
      )}

      {/* Daftar Kios Terdaftar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Daftar Usaha / Kios Anda ({outlets.length} Kios)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik <strong>Ubah Detail &amp; Logo</strong> untuk mengubah identitas usaha, atau{" "}
              <strong>Masuk Kios</strong> untuk membuka operasional kios tersebut.
            </p>
          </div>
          {activeOutletId && (
            <button
              type="button"
              onClick={handleLeaveOutlet}
              disabled={isPending}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer self-start sm:self-auto"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar Kios Aktif</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3.5">Logo &amp; Nama Kios</th>
                <th className="px-4 py-3.5">Alamat &amp; Kontak</th>
                <th className="px-4 py-3.5">Pajak &amp; Struk</th>
                <th className="px-4 py-3.5">Sesi Kerja</th>
                <th className="px-4 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {outlets.map((outlet) => {
                const isActiveSession = outlet.id === activeOutletId;

                return (
                  <tr
                    key={outlet.id}
                    className={`transition-colors ${
                      isActiveSession
                        ? "bg-sky-50/40 dark:bg-sky-950/20"
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-2xs overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={outlet.logoUrl || DEFAULT_LOGO_PATH}
                            alt={outlet.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: outlet.themeColor }}
                              title={`Warna grafik: ${outlet.themeColor}`}
                            />
                            <span className="truncate">{outlet.name}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                            {outlet.description || "Usaha Kuliner & F&B"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="max-w-[220px] truncate">
                          {outlet.address || "Belum diatur"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{outlet.phone || "-"}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          PB1:{" "}
                          <strong
                            className={
                              outlet.taxEnabled
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {outlet.taxEnabled && outlet.taxPercent
                              ? `${outlet.taxPercent}%`
                              : "Nonaktif"}
                          </strong>
                        </span>
                        <span>
                          Service:{" "}
                          <strong
                            className={
                              outlet.serviceEnabled
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {outlet.serviceEnabled && outlet.servicePercent
                              ? `${outlet.servicePercent}%`
                              : "Nonaktif"}
                          </strong>
                        </span>
                        {outlet.receiptFooter && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            Struk: {outlet.receiptFooter}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {isActiveSession ? (
                        <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <Store className="h-3.5 w-3.5" />
                          <span>Sedang Dimasuki</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEnterOutlet(outlet.id)}
                          disabled={isPending}
                          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 px-3.5 text-xs font-semibold text-[#1E88E5] dark:text-sky-300 hover:bg-[#1E88E5] hover:text-white transition cursor-pointer"
                        >
                          <span>Masuk Kios</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/landing-page?outletId=${encodeURIComponent(outlet.id)}`}
                          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                          title="Upload banner iklan dan atur link tombol landing page"
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                          <span>Banner &amp; Link</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => openEditModal(outlet)}
                          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Ubah Detail &amp; Logo</span>
                        </button>

                        {confirmResetId === outlet.id ? (
                          <div className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-1">
                            <button
                              type="button"
                              onClick={() => handleResetDemoData(outlet.id)}
                              disabled={isPending}
                              className="h-9 rounded-lg bg-rose-600 px-2.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                            >
                              Ya, Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmResetId(null)}
                              className="h-9 rounded-lg px-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmResetId(outlet.id)}
                            disabled={isPending}
                            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title="Hapus semua riwayat transaksi simulasi demo di kios ini"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset</span>
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

        <div className="bg-amber-50/70 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/50 px-5 py-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong>Catatan Keamanan:</strong> Tombol{" "}
            <strong>Reset</strong> hanya untuk membersihkan data simulasi demo
            sebelum beroperasi penuh (menghapus order &amp; pembayaran kios
            tersebut; data menu, bahan baku, dan audit log tetap tersimpan).
          </p>
        </div>
      </div>

      {/* Modal Edit Detail, Logo & Warna Kios */}
      {editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Setting Kios — {editingOutlet.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Perubahan nama, logo, warna grafik, dan detail usaha akan tersimpan permanen ke database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOutlet(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup modal edit kios"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Nama Usaha / Kios *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Detail Usaha / Tagline
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Specialty Coffee & Bakery"
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Alamat Kios
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="0812-..."
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Catatan Footer Struk Pelanggan
                  </label>
                  <input
                    type="text"
                    value={editForm.receiptFooter}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        receiptFooter: e.target.value,
                      }))
                    }
                    placeholder="Terima kasih telah berkunjung!"
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                </div>
              </div>

              <OutletLogoAndColorFields
                form={editForm}
                onChange={setEditForm}
                idPrefix="edit"
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOutlet(null)}
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-11 rounded-xl bg-[#1E88E5] px-5 text-xs font-semibold text-white hover:bg-[#1976D2] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Menyimpan..." : "Simpan Setting Kios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
