"use client";

import React from "react";
import Image from "next/image";
import { Heart } from "lucide-react";

export function LoginHeroCarousel() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[460px] px-4 py-6 select-none">
      {/* Awan Dekoratif Kiri & Kanan ala Referensi 3D Clay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-2 top-24 h-10 w-16 rounded-full bg-white/90 shadow-[0_8px_20px_rgba(30,136,229,0.16)] blur-[0.2px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-1 bottom-24 h-11 w-16 rounded-full bg-white/90 shadow-[0_8px_20px_rgba(30,136,229,0.16)] blur-[0.2px]"
      />

      {/* Kartu Welcome 3D Lembut Bernuansa Biru */}
      <div className="relative w-full overflow-hidden rounded-[36px] border-2 border-white bg-gradient-to-b from-[#FAF7F3] via-[#F5F9FF] to-[#E6F1FE] pt-8 px-6 pb-0 shadow-[0_28px_65px_-16px_rgba(30,136,229,0.28)]">
        {/* Header Welcome Back + Hati & Sinar Kuning Kecil ala Referensi */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-100/90 shadow-xs">
            <Heart className="h-4 w-4 fill-rose-400 text-rose-400" />
          </div>

          <div className="relative inline-flex items-center gap-2.5">
            {/* Aksen Sinar Kiri */}
            <div
              aria-hidden="true"
              className="flex flex-col gap-1 items-end mr-0.5"
            >
              <span className="h-1 w-3.5 rounded-full bg-amber-300 rotate-12" />
              <span className="h-1 w-4 rounded-full bg-amber-400" />
              <span className="h-1 w-3.5 rounded-full bg-amber-300 -rotate-12" />
            </div>

            <h2 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#1E88E5] drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]">
              Welcome Back
            </h2>

            {/* Aksen Sinar Kanan */}
            <div
              aria-hidden="true"
              className="flex flex-col gap-1 items-start ml-0.5"
            >
              <span className="h-1 w-3.5 rounded-full bg-amber-300 -rotate-12" />
              <span className="h-1 w-4 rounded-full bg-amber-400" />
              <span className="h-1 w-3.5 rounded-full bg-amber-300 rotate-12" />
            </div>
          </div>

          <p className="mt-1.5 text-sm font-medium text-slate-500">
            Masuk untuk melanjutkan perjalanan bisnis Anda
          </p>
        </div>

        {/* Ilustrasi Karakter 3D Memeluk Logo 1621 Group dengan Animasi Mengambang Halus */}
        <div className="relative mt-4 flex justify-center">
          <div
            className="relative h-[340px] w-[340px] sm:h-[360px] sm:w-[360px]"
            style={{ animation: "floatGentle 4.5s ease-in-out infinite" }}
          >
            <Image
              src="/images/login-welcome-mascot.jpg"
              alt="Karakter 3D memeluk logo 1621 Group"
              fill
              className="object-contain object-bottom mix-blend-multiply"
              sizes="360px"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
