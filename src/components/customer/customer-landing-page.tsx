"use client";

import * as React from "react";
import {
  CalendarCheck,
  Clock,
  Coffee,
  Handshake,
  Mail,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import type { CustomerTablePublicData } from "@/server/customer-order";

interface CustomerLandingPageProps {
  data: CustomerTablePublicData;
  onEnterMenu: () => void;
}

export function CustomerLandingPage({
  data,
  onEnterMenu,
}: CustomerLandingPageProps) {
  const { outlet, table } = data;
  const banners = outlet.landingBanners;
  const [activeSlide, setActiveSlide] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);

  // Auto-slide carousel banner iklan tiap 4,5 detik bila ada lebih dari 1 banner
  React.useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || banners.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (delta > 40) {
      setActiveSlide((prev) => (prev - 1 + banners.length) % banners.length);
    } else if (delta < -40) {
      setActiveSlide((prev) => (prev + 1) % banners.length);
    }
    touchStartX.current = null;
  };

  const renderExternalTile = (params: {
    label: string;
    url: string | null;
    icon: React.ReactNode;
    gradientClass: string;
    missingMessage: string;
  }) => {
    const commonClass = `relative flex min-h-[124px] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl p-3 text-center text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] ${params.gradientClass}`;

    if (params.url) {
      return (
        <a
          href={params.url}
          target="_blank"
          rel="noopener noreferrer"
          className={commonClass}
        >
          <span className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10" />
          <span className="relative z-10">{params.icon}</span>
          <span className="relative z-10 text-xs font-extrabold tracking-wide uppercase leading-tight">
            {params.label}
          </span>
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={() => toast.info(params.missingMessage)}
        className={`${commonClass} cursor-pointer`}
      >
        <span className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10" />
        <span className="relative z-10">{params.icon}</span>
        <span className="relative z-10 text-xs font-extrabold tracking-wide uppercase leading-tight">
          {params.label}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] pb-10 text-slate-900">
      <div className="mx-auto max-w-md">
        {/* 1. Carousel Banner Iklan / Promo Bagian Atas */}
        <div
          className="relative w-full aspect-[16/9] overflow-hidden bg-slate-900"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {banners.length > 0 ? (
            <>
              <div
                className="flex h-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {banners.map((banner, idx) => (
                  <div
                    key={banner.id}
                    className="relative h-full w-full shrink-0 bg-slate-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner.imageUrl}
                      alt={banner.caption || `Promo ${outlet.name} #${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {banner.caption && (
                      <div className="absolute inset-x-0 bottom-8 flex justify-center px-4">
                        <span className="rounded-full bg-slate-950/70 backdrop-blur-xs px-3 py-1 text-[11px] font-semibold text-white shadow">
                          {banner.caption}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {banners.length > 1 && (
                <div className="absolute inset-x-0 bottom-7 flex items-center justify-center gap-1.5 z-10">
                  {banners.map((b, idx) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      aria-label={`Slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === activeSlide
                          ? "w-5 bg-white shadow"
                          : "w-2 bg-white/50 hover:bg-white/80"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center px-6 pb-4 text-center text-white"
              style={{
                background: `linear-gradient(135deg, ${outlet.themeColor || "#1E2F3D"} 0%, #1F2E3D 100%)`,
              }}
            >
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs">
                Selamat Datang
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                {outlet.name}
              </h2>
              <p className="mt-1 text-xs text-white/85">
                {outlet.description || "Pesan menu favorit Anda langsung dari meja"}
              </p>
            </div>
          )}
        </div>

        {/* 2. Kartu Identitas Usaha, Jam Buka & Nomor Meja */}
        <div className="relative z-10 -mt-5 space-y-5 px-4">
          <div className="rounded-3xl bg-[#2E3E4E] px-5 py-5 text-center text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)] space-y-3.5">
            <div className="flex items-center justify-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={outlet.logoUrl}
                  alt={outlet.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="text-left min-w-0">
                <h1 className="text-base font-extrabold tracking-tight text-white truncate">
                  {outlet.name}
                </h1>
                {outlet.description && (
                  <p className="text-[11px] text-slate-300 truncate">
                    {outlet.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-200">
              <Clock className="h-3.5 w-3.5 text-amber-300 shrink-0" />
              <span>{outlet.operatingHours}</span>
            </div>

            {/* Kotak Nomor Meja Kontras */}
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-slate-900 shadow-xs">
              <span className="text-sm font-semibold text-slate-600">
                Nomor Meja
              </span>
              <span className="text-base font-black text-amber-600">
                {table.name}
              </span>
            </div>

            <p className="text-xs italic text-slate-200/95">
              &quot;
              {outlet.landingTagline ||
                outlet.description ||
                "Nikmati sajian hangat & pelayanan terbaik kami"}
              &quot;
            </p>
          </div>

          {/* 3. Grid 2x2 Tombol Aksi Utama */}
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_6px_24px_rgba(15,23,42,0.06)]">
            <div className="grid grid-cols-2 gap-3.5">
              {/* MENU ORDER */}
              <button
                type="button"
                onClick={onEnterMenu}
                className="relative flex min-h-[124px] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#EA580C] to-[#C2410C] p-3 text-center text-white shadow-md transition hover:brightness-105 active:scale-[0.98] cursor-pointer"
              >
                <span className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/15" />
                <Coffee className="relative z-10 h-10 w-10 stroke-[2.2]" />
                <span className="relative z-10 text-xs font-extrabold tracking-wide uppercase">
                  MENU ORDER
                </span>
              </button>

              {/* PENAWARAN KERJASAMA */}
              {renderExternalTile({
                label: "PENAWARAN KERJASAMA",
                url: outlet.partnershipUrl,
                icon: <Handshake className="h-10 w-10 stroke-[2.1]" />,
                gradientClass:
                  "bg-gradient-to-br from-[#1F3142] to-[#111B24]",
                missingMessage:
                  "Tautan Penawaran Kerjasama belum diatur oleh pihak toko.",
              })}

              {/* RESERVASI */}
              {renderExternalTile({
                label: "RESERVASI",
                url: outlet.reservationUrl,
                icon: <CalendarCheck className="h-10 w-10 stroke-[2.1]" />,
                gradientClass:
                  "bg-gradient-to-br from-[#236B32] to-[#15451F]",
                missingMessage:
                  "Tautan Reservasi belum diatur oleh pihak toko.",
              })}

              {/* KRITIK & SARAN */}
              {renderExternalTile({
                label: "KRITIK & SARAN",
                url: outlet.feedbackUrl,
                icon: <Mail className="h-10 w-10 stroke-[2.1]" />,
                gradientClass:
                  "bg-gradient-to-br from-[#E5A932] to-[#C28114]",
                missingMessage:
                  "Tautan Kritik & Saran belum diatur oleh pihak toko.",
              })}
            </div>
          </div>

          {/* 4. Section Berita & Promo Bagian Bawah */}
          {(outlet.landingNewsBannerUrl || outlet.address) && (
            <section className="space-y-2.5 pt-1">
              <h2 className="text-lg font-black uppercase tracking-tight text-[#C84B31] px-0.5">
                {outlet.landingNewsTitle || "PROMO & BERITA"}
              </h2>

              {outlet.landingNewsBannerUrl ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={outlet.landingNewsBannerUrl}
                    alt={outlet.landingNewsTitle}
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : null}

              {outlet.address && (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-xs text-slate-600 shadow-2xs">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{outlet.address}</span>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
