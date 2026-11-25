"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Clock,
  ExternalLink,
  Handshake,
  ImagePlus,
  MessageSquareHeart,
  Newspaper,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { compressImageFileToDataUrl } from "@/lib/client-image";
import type { LandingBannerItem, OutletView } from "@/lib/outlets";
import { updateOutletLandingPageAction } from "@/server/outlets";

interface OutletLandingEditorProps {
  outlet: OutletView;
  outlets?: OutletView[];
  onSaved?: () => void;
  onClose?: () => void;
}

export function OutletLandingEditor({
  outlet: initialOutlet,
  outlets,
  onSaved,
  onClose,
}: OutletLandingEditorProps) {
  const router = useRouter();
  const [selectedOutletId, setSelectedOutletId] = React.useState(
    initialOutlet.id
  );

  const activeOutlet = React.useMemo(() => {
    if (outlets && outlets.length > 0) {
      return outlets.find((o) => o.id === selectedOutletId) ?? initialOutlet;
    }
    return initialOutlet;
  }, [outlets, selectedOutletId, initialOutlet]);

  const [banners, setBanners] = React.useState<LandingBannerItem[]>(
    activeOutlet.landingBanners
  );
  const [newsTitle, setNewsTitle] = React.useState(
    activeOutlet.landingNewsTitle || "PROMO & BERITA"
  );
  const [newsBannerUrl, setNewsBannerUrl] = React.useState(
    activeOutlet.landingNewsBannerUrl ?? ""
  );
  const [operatingHours, setOperatingHours] = React.useState(
    activeOutlet.operatingHours || "08.00 - 22.00 WIB"
  );
  const [landingTagline, setLandingTagline] = React.useState(
    activeOutlet.landingTagline ?? ""
  );
  const [partnershipUrl, setPartnershipUrl] = React.useState(
    activeOutlet.partnershipUrl ?? ""
  );
  const [reservationUrl, setReservationUrl] = React.useState(
    activeOutlet.reservationUrl ?? ""
  );
  const [feedbackUrl, setFeedbackUrl] = React.useState(
    activeOutlet.feedbackUrl ?? ""
  );

  const [manualBannerUrl, setManualBannerUrl] = React.useState("");
  const [isProcessingUpload, setIsProcessingUpload] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Sinkronkan form apabila user mengganti pilihan kios
  React.useEffect(() => {
    setBanners(activeOutlet.landingBanners);
    setNewsTitle(activeOutlet.landingNewsTitle || "PROMO & BERITA");
    setNewsBannerUrl(activeOutlet.landingNewsBannerUrl ?? "");
    setOperatingHours(activeOutlet.operatingHours || "08.00 - 22.00 WIB");
    setLandingTagline(activeOutlet.landingTagline ?? "");
    setPartnershipUrl(activeOutlet.partnershipUrl ?? "");
    setReservationUrl(activeOutlet.reservationUrl ?? "");
    setFeedbackUrl(activeOutlet.feedbackUrl ?? "");
  }, [activeOutlet]);

  const handleUploadCarouselBanner = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (banners.length >= 5) {
      toast.error("Maksimal 5 banner iklan pada carousel atas.");
      e.target.value = "";
      return;
    }

    setIsProcessingUpload(true);
    try {
      const remainingSlots = 5 - banners.length;
      const toProcess = files.slice(0, remainingSlots);
      const uploaded: LandingBannerItem[] = [];

      for (const file of toProcess) {
        if (!file.type.startsWith("image/")) {
          toast.error(`File "${file.name}" bukan gambar yang valid.`);
          continue;
        }
        const dataUrl = await compressImageFileToDataUrl(file, {
          maxWidth: 1200,
          maxHeight: 720,
          maxDataUrlLength: 550_000,
          preserveTransparency: false,
        });
        uploaded.push({
          id: `bnr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          imageUrl: dataUrl,
          caption: "",
        });
      }

      if (uploaded.length > 0) {
        setBanners((prev) => [...prev, ...uploaded]);
        toast.success(
          `${uploaded.length} banner iklan ditambahkan. Jangan lupa klik Simpan.`
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses banner iklan."
      );
    } finally {
      setIsProcessingUpload(false);
      e.target.value = "";
    }
  };

  const handleAddBannerFromUrl = () => {
    const trimmed = manualBannerUrl.trim();
    if (!trimmed) return;
    if (banners.length >= 5) {
      toast.error("Maksimal 5 banner iklan pada carousel atas.");
      return;
    }
    if (
      !trimmed.startsWith("/") &&
      !trimmed.startsWith("https://") &&
      !trimmed.startsWith("http://")
    ) {
      toast.error("URL gambar harus diawali https://, http://, atau /.");
      return;
    }
    setBanners((prev) => [
      ...prev,
      {
        id: `bnr-${Date.now()}`,
        imageUrl: trimmed,
        caption: "",
      },
    ]);
    setManualBannerUrl("");
  };

  const handleUploadNewsBanner = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, WebP).");
      e.target.value = "";
      return;
    }
    setIsProcessingUpload(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 1200,
        maxHeight: 800,
        maxDataUrlLength: 550_000,
        preserveTransparency: false,
      });
      setNewsBannerUrl(dataUrl);
      toast.success("Banner promo/berita bawah berhasil dimuat.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses banner berita."
      );
    } finally {
      setIsProcessingUpload(false);
      e.target.value = "";
    }
  };

  const moveBanner = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= banners.length) return;
    setBanners((prev) => {
      const next = [...prev];
      const current = next[idx];
      const swap = next[targetIdx];
      if (!current || !swap) return prev;
      next[idx] = swap;
      next[targetIdx] = current;
      return next;
    });
  };

  const removeBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBannerCaption = (id: string, caption: string) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, caption } : b))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateOutletLandingPageAction({
        outletId: activeOutlet.id,
        operatingHours,
        landingTagline,
        landingBanners: banners,
        landingNewsTitle: newsTitle,
        landingNewsBannerUrl: newsBannerUrl,
        partnershipUrl,
        reservationUrl,
        feedbackUrl,
      });

      if (res.ok) {
        toast.success(res.message);
        router.refresh();
        onSaved?.();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Pemilih Kios bila dipakai di halaman standalone multi-outlet */}
      {outlets && outlets.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Pilih Usaha / Kios yang Diatur
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Setiap kios memiliki banner iklan, jam operasional, dan tautan aksinya sendiri.
            </p>
          </div>
          <select
            value={activeOutlet.id}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-slate-100"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Form Pengaturan Banner Iklan, Info Meja, Berita & Link */}
        <div className="xl:col-span-8 space-y-5">
          {/* 1. Upload Banner Iklan Atas (Carousel Slider) */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-[#1E88E5]" />
                  <span>Banner Iklan Atas / Promo Slider ({banners.length}/5)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tampil paling atas di Landing Page saat pelanggan scan QR meja. Disarankan rasio landscape (16:9 atau 2:1).
                </p>
              </div>

              <label
                htmlFor={`upload-carousel-banner-${activeOutlet.id}`}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition ${
                  banners.length >= 5
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-[#1E88E5] hover:bg-[#1976D2] cursor-pointer"
                }`}
              >
                <Upload className="h-4 w-4" />
                <span>
                  {isProcessingUpload ? "Memproses..." : "Upload Banner Iklan"}
                </span>
              </label>
              <input
                id={`upload-carousel-banner-${activeOutlet.id}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={banners.length >= 5 || isProcessingUpload}
                onChange={handleUploadCarouselBanner}
                className="sr-only"
              />
            </div>

            {/* Daftar Banner yang Sudah Diunggah */}
            {banners.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada banner iklan yang diunggah. Klik tombol{" "}
                <strong>Upload Banner Iklan</strong> di atas atau tempel URL gambar di bawah.
              </div>
            ) : (
              <div className="space-y-3">
                {banners.map((banner, idx) => (
                  <div
                    key={banner.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-3"
                  >
                    <div className="relative h-24 w-full sm:w-44 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={banner.imageUrl}
                        alt={`Banner Iklan ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Judul / Keterangan Singkat (opsional)
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={banner.caption ?? ""}
                        onChange={(e) =>
                          updateBannerCaption(banner.id, e.target.value)
                        }
                        placeholder="Misal: Promo Combo Hemat 25K setiap hari"
                        className="h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs focus:border-[#1E88E5] focus:outline-none"
                      />
                    </div>

                    <div className="flex sm:flex-col items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveBanner(idx, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:bg-slate-100 cursor-pointer"
                        title="Geser ke atas"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === banners.length - 1}
                        onClick={() => moveBanner(idx, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:bg-slate-100 cursor-pointer"
                        title="Geser ke bawah"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBanner(banner.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus banner"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Alternatif Tambah Banner via URL */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                value={manualBannerUrl}
                onChange={(e) => setManualBannerUrl(e.target.value)}
                placeholder="Atau tempel URL gambar banner iklan (https://...)"
                className="h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs focus:border-[#1E88E5] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddBannerFromUrl}
                disabled={!manualBannerUrl.trim() || banners.length >= 5}
                className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
              >
                Tambah URL Banner
              </button>
            </div>
          </section>

          {/* 2. Info Kartu Brand, Jam Buka & Tagline */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Clock className="h-4 w-4 text-[#1E88E5]" />
              <span>Kartu Identitas Usaha &amp; Nomor Meja</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Jam Operasional Kios
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  placeholder="Contoh: 08.00 - 22.00 WIB"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Kutipan / Tagline di Kartu Meja
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={landingTagline}
                  onChange={(e) => setLandingTagline(e.target.value)}
                  placeholder="Contoh: Nikmati kopi & hidangan hangat bersama kami"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* 3. Upload Link Tombol Aksi (Penawaran Kerjasama, Reservasi, Kritik & Saran) */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#1E88E5]" />
                <span>Tautan (Link) Tombol Landing Page</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Isi dengan link WhatsApp (`https://wa.me/628...`), Google Form (`https://forms.gle/...`), web reservasi, atau `mailto:`. Kosongkan jika tombol belum ingin diaktifkan.
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Link Penawaran Kerjasama */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Handshake className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
                  <span>Link Tombol &quot;Penawaran Kerjasama&quot;</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={500}
                    value={partnershipUrl}
                    onChange={(e) => setPartnershipUrl(e.target.value)}
                    placeholder="https://wa.me/62812... atau https://forms.gle/..."
                    className="h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                  {partnershipUrl.trim() && (
                    <a
                      href={partnershipUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-[#1E88E5] hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Uji</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Link Reservasi */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Link Tombol &quot;Reservasi&quot;</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={500}
                    value={reservationUrl}
                    onChange={(e) => setReservationUrl(e.target.value)}
                    placeholder="https://wa.me/62812... atau https://link-reservasi..."
                    className="h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                  {reservationUrl.trim() && (
                    <a
                      href={reservationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-[#1E88E5] hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Uji</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Link Kritik & Saran */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  <MessageSquareHeart className="h-3.5 w-3.5 text-amber-600" />
                  <span>Link Tombol &quot;Kritik &amp; Saran&quot;</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={500}
                    value={feedbackUrl}
                    onChange={(e) => setFeedbackUrl(e.target.value)}
                    placeholder="https://forms.gle/... atau https://wa.me/62812..."
                    className="h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                  />
                  {feedbackUrl.trim() && (
                    <a
                      href={feedbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-[#1E88E5] hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Uji</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Banner Berita & Promo Bagian Bawah */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Newspaper className="h-4 w-4 text-[#1E88E5]" />
              <span>Banner Promo / Berita Bawah</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Judul Bagian (mis. &quot;PROMO &amp; BERITA&quot; atau &quot;KEDAI NEWS&quot;)
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm focus:border-[#1E88E5] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Upload Gambar Banner Bawah (opsional)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={`upload-news-banner-${activeOutlet.id}`}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 px-4 text-xs font-bold text-white cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Banner Berita</span>
                  </label>
                  <input
                    id={`upload-news-banner-${activeOutlet.id}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={isProcessingUpload}
                    onChange={handleUploadNewsBanner}
                    className="sr-only"
                  />
                  {newsBannerUrl && (
                    <button
                      type="button"
                      onClick={() => setNewsBannerUrl("")}
                      className="h-11 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>

            {newsBannerUrl && (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 max-w-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newsBannerUrl}
                  alt="Preview banner berita bawah"
                  className="w-full h-auto max-h-56 object-cover"
                />
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            )}
            <button
              type="submit"
              disabled={isPending || isProcessingUpload}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00884A] hover:bg-[#00733E] disabled:opacity-55 px-6 text-sm font-bold text-white shadow-sm cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>
                {isPending ? "Menyimpan..." : "Simpan Pengaturan Landing Page"}
              </span>
            </button>
          </div>
        </div>

        {/* Kolom Kanan: Pratinjau Mini Tampilan HP Pelanggan */}
        <aside className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Pratinjau Tampilan HP Pelanggan
          </div>
          <div className="mx-auto max-w-[300px] overflow-hidden rounded-[26px] border-4 border-slate-800 bg-[#F4F6FA] text-slate-900 shadow-lg">
            {/* Mini Banner */}
            <div className="h-28 w-full bg-gradient-to-br from-amber-100 to-orange-200 relative overflow-hidden">
              {banners[0] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={banners[0].imageUrl}
                  alt="Preview banner"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] font-bold text-amber-900/70">
                  Banner Iklan Kios
                </div>
              )}
            </div>

            {/* Mini Brand Info Card */}
            <div className="px-3 -mt-4 relative z-10 space-y-3 pb-4">
              <div className="rounded-2xl bg-[#34495E] p-3 text-white text-center shadow-md space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeOutlet.logoUrl}
                    alt={activeOutlet.name}
                    className="h-6 w-6 rounded-md bg-white object-contain p-0.5"
                  />
                  <span className="text-xs font-extrabold truncate">
                    {activeOutlet.name}
                  </span>
                </div>
                <div className="text-[10px] text-slate-200 flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{operatingHours}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800">
                  <span>Nomor Meja</span>
                  <span className="text-amber-600">Meja 1</span>
                </div>
                <div className="text-[9px] italic text-slate-200 line-clamp-1">
                  &quot;{landingTagline || activeOutlet.description}&quot;
                </div>
              </div>

              {/* Mini 2x2 Action Grid */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2.5 shadow-2xs">
                <div className="rounded-xl bg-[#D84315] p-2.5 text-center text-white text-[9px] font-extrabold">
                  MENU ORDER
                </div>
                <div
                  className={`rounded-xl bg-[#1E2F3D] p-2.5 text-center text-white text-[9px] font-extrabold ${
                    partnershipUrl.trim() ? "" : "opacity-55"
                  }`}
                >
                  KERJASAMA
                </div>
                <div
                  className={`rounded-xl bg-[#245A2D] p-2.5 text-center text-white text-[9px] font-extrabold ${
                    reservationUrl.trim() ? "" : "opacity-55"
                  }`}
                >
                  RESERVASI
                </div>
                <div
                  className={`rounded-xl bg-[#D99B26] p-2.5 text-center text-white text-[9px] font-extrabold ${
                    feedbackUrl.trim() ? "" : "opacity-55"
                  }`}
                >
                  KRITIK &amp; SARAN
                </div>
              </div>

              {/* Mini News */}
              {newsBannerUrl && (
                <div className="space-y-1">
                  <div className="text-[11px] font-black uppercase text-[#C84B31]">
                    {newsTitle}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={newsBannerUrl}
                      alt="Mini news preview"
                      className="h-20 w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
