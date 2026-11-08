"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { BarChart3, CheckCircle2, Layers } from "lucide-react";

const SLIDES = [
  {
    title: "Laporan Analisis Lengkap & Akurat",
    subtitle:
      "Hindari salah hitung! Dengan 1621F&B, semua transaksi tercatat otomatis!",
  },
  {
    title: "BOM & Auto-Deduct Bahan Baku",
    subtitle:
      "Stok bahan baku terpotong presisi sesuai resep saat transaksi kasir & QR meja lunas.",
  },
  {
    title: "Multi-Outlet & Pembukuan 5 Tab",
    subtitle:
      "Kelola puluhan cabang terpusat dengan jurnal otomatis, laba rugi, dan neraca real-time.",
  },
];

export function LoginHeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center max-w-lg px-6 py-12 select-none">
      {/* Ilustrasi Bisnis Minimalis dengan Lingkaran Oranye/Kuning Khas ESB */}
      <div className="relative mb-8 flex items-center justify-center">
        <div className="h-64 w-64 md:h-72 md:w-72 rounded-full bg-gradient-to-tr from-[#F58220] to-amber-300 shadow-inner flex flex-col items-center justify-center relative overflow-hidden p-6">
          <div className="absolute -bottom-6 w-full h-24 bg-white/15 rounded-full" />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/20 rounded-full" />

          <div className="relative z-10 rounded-2xl bg-white/95 backdrop-blur-xs p-5 shadow-xl border border-white/60 flex flex-col items-center gap-3 w-48">
            <Image
              src="/logo-1621group-stacked.png"
              alt="1621 Group"
              width={110}
              height={74}
              className="h-14 w-auto object-contain"
              priority
            />
            <div className="w-full border-t border-slate-100 pt-2.5 flex items-center justify-between text-slate-600 text-[11px] font-medium">
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5 text-[#1E88E5]" />
                <span>POSLite</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Real-Time</span>
              </span>
            </div>
          </div>
        </div>

        <div className="absolute -right-2 bottom-6 bg-white rounded-xl px-3 py-2 shadow-md border border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Layers className="h-4 w-4 text-[#1E88E5]" />
          <span>Multi-Outlet</span>
        </div>
      </div>

      {/* Teks Carousel */}
      <div className="min-h-[80px]">
        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight transition-all duration-300">
          {SLIDES[currentSlide]?.title}
        </h3>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-md">
          {SLIDES[currentSlide]?.subtitle}
        </p>
      </div>

      {/* 3 Dots Indicator (Persis Screenshot 1) */}
      <div className="mt-6 flex items-center gap-1.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              currentSlide === idx
                ? "w-6 bg-[#1E88E5]"
                : "w-2 bg-slate-300 hover:bg-slate-400"
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

