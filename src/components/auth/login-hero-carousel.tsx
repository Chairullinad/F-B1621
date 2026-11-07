"use client";

import React, { useState, useEffect } from "react";

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
      {/* Ilustrasi Profesional Bisnis dengan Lingkaran Oranye/Kuning Sesuai Screenshot 1 */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Background splash circle */}
        <div className="h-64 w-64 md:h-72 md:w-72 rounded-full bg-gradient-to-tr from-amber-400 to-amber-300 shadow-inner flex items-center justify-center relative overflow-hidden">
          {/* Subtle wave decoration */}
          <div className="absolute -bottom-6 w-full h-24 bg-white/20 rounded-full" />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/25 rounded-full" />
        </div>

        {/* Karakter Profesional Bisnis (Emoji / Stylized Vector Presentation) */}
        <div className="absolute text-8xl md:text-9xl drop-shadow-xl animate-pulse duration-1000">
          👩‍💼
        </div>
        <div className="absolute -right-2 bottom-6 bg-white rounded-2xl p-2.5 shadow-md border border-slate-100 text-3xl">
          💻
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
                ? "w-6 bg-[#0284C7]"
                : "w-2 bg-slate-300 hover:bg-slate-400"
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
