import * as React from "react";
import { getStandeeContrastPalette } from "@/lib/outlets";

interface TableQrStandeeCardProps {
  outletName: string;
  outletLogoUrl: string;
  outletThemeColor: string;
  tableNo: number;
  qrSvg: string;
  compact?: boolean;
}

/**
 * Komponen kartu/stiker Standee QR Meja berbentuk persegi (1:1) dengan:
 * - Tab logo putih di atas: Logo Outlet (besar & jelas) | Logo 1621 Group
 * - Background warna penuh dinamis sesuai `themeColor` pada Setting Kios
 * - Headline "mau order? SCAN AJA", QR Code penuh, panduan 3 langkah berikon, dan Nomor Meja 2 digit
 */
export function TableQrStandeeCard({
  outletName,
  outletLogoUrl,
  outletThemeColor,
  tableNo,
  qrSvg,
  compact = false,
}: TableQrStandeeCardProps) {
  const palette = getStandeeContrastPalette(outletThemeColor);
  const formattedTableNo = String(tableNo).padStart(2, "0");

  const strokeWidthPx = compact ? "2.2px" : "3px";

  return (
    <div
      className={`relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-2xl shadow-lg select-none ${
        compact ? "px-3.5 pb-3 pt-0" : "max-w-[420px] px-5 pb-4 pt-0"
      }`}
      style={{
        backgroundColor: palette.backgroundHex,
        color: palette.foregroundColor,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* 1. Tab Putih Atas: Logo Outlet (Lebih Besar) | Logo 1621 Group */}
      <div className="flex justify-center">
        <div
          className={`inline-flex items-center justify-center rounded-b-2xl bg-white shadow-sm ${
            compact ? "gap-2.5 px-3.5 py-1.5" : "gap-3.5 px-5 py-2"
          }`}
        >
          <div
            className={`flex items-center justify-center ${
              compact ? "h-9 max-w-[92px]" : "h-12 max-w-[128px]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outletLogoUrl || "/logo-1621group-stacked.png"}
              alt={outletName}
              className="h-full w-auto max-w-full object-contain"
            />
          </div>

          <span
            className={`w-px bg-slate-300 shrink-0 ${
              compact ? "h-6" : "h-8"
            }`}
          />

          <div
            className={`flex items-center justify-center ${
              compact ? "h-6 max-w-[82px]" : "h-8 max-w-[110px]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-1621group.png"
              alt="1621 Group"
              className="h-full w-auto max-w-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* 2. Headline Besar & Padat: mau order? SCAN AJA */}
      <div className="text-center leading-none mt-1">
        <p
          className={`font-extrabold tracking-tight ${
            compact ? "text-base mb-0.5" : "text-2xl mb-1"
          }`}
        >
          mau order?
        </p>
        <p
          className={`font-black uppercase tracking-tighter leading-[0.88] ${
            compact ? "text-[32px]" : "text-[46px]"
          }`}
          style={{
            color: "#FFFFFF",
            WebkitTextStroke: `${strokeWidthPx} ${palette.outlineHex}`,
            paintOrder: "stroke fill",
            textShadow: `0 3px 0 ${palette.outlineHex}`,
          }}
        >
          SCAN AJA
        </p>
      </div>

      {/* 3. Body Utama: QR Code Besar (Kiri) + 3 Langkah Berikon (Kanan) */}
      <div
        className={`grid grid-cols-12 items-center my-auto ${
          compact ? "gap-2.5 py-1" : "gap-3.5 py-2"
        }`}
      >
        {/* Kotak Putih QR Code */}
        <div className="col-span-6 flex items-center justify-center">
          <div
            className={`w-full aspect-square rounded-2xl bg-white shadow-md flex items-center justify-center ${
              compact ? "p-1.5 border-2" : "p-2 border-[3px]"
            }`}
            style={{ borderColor: palette.outlineHex }}
          >
            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        </div>

        {/* Panduan 3 Langkah: Scan & Order, Bayar, Pesanan Diantar */}
        <div
          className={`col-span-6 flex flex-col justify-center text-left ${
            compact ? "gap-2" : "gap-3"
          }`}
        >
          {/* Langkah 1 */}
          <div className="flex items-center gap-1.5">
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-white font-black ${
                compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
              }`}
              style={{ color: palette.pillTextColor }}
            >
              1
            </span>
            <svg
              viewBox="0 0 28 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 ${compact ? "h-7 w-7" : "h-9 w-9"}`}
              aria-hidden="true"
            >
              <rect x="4" y="3" width="11" height="16" rx="1.5" />
              <rect x="12" y="7" width="12" height="18" rx="2" fill="none" />
              <path d="M15.5 11.5h2v2h-2zM18.5 11.5h2v2h-2zM15.5 14.5h2v2h-2zM18.5 14.5h2v2h-2zM16.5 21.5h3" />
            </svg>
            <div className="leading-none">
              <span
                className={`inline-block rounded bg-white font-black uppercase tracking-wide ${
                  compact
                    ? "px-1.5 py-0.5 text-[10px]"
                    : "px-2 py-0.5 text-xs"
                }`}
                style={{ color: palette.pillTextColor }}
              >
                SCAN
              </span>
              <div
                className={`font-black uppercase tracking-tight mt-0.5 ${
                  compact ? "text-[10px]" : "text-xs"
                }`}
              >
                &amp; ORDER
              </div>
            </div>
          </div>

          {/* Langkah 2 */}
          <div className="flex items-center gap-1.5">
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-white font-black ${
                compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
              }`}
              style={{ color: palette.pillTextColor }}
            >
              2
            </span>
            <svg
              viewBox="0 0 28 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 ${compact ? "h-7 w-7" : "h-9 w-9"}`}
              aria-hidden="true"
            >
              <path d="M4 16h20l-1.5 7.5H5.5L4 16z" />
              <path d="M6.5 16v-5.5h15V16" />
              <rect x="10" y="4.5" width="8" height="4.5" rx="0.8" />
              <path d="M14 9v1.5M9 19.5h10M9.5 13h2M13 13h2M16.5 13h2" />
            </svg>
            <div>
              <span
                className={`inline-block rounded bg-white font-black uppercase tracking-wide ${
                  compact
                    ? "px-1.5 py-0.5 text-[10px]"
                    : "px-2 py-0.5 text-xs"
                }`}
                style={{ color: palette.pillTextColor }}
              >
                BAYAR
              </span>
            </div>
          </div>

          {/* Langkah 3 */}
          <div className="flex items-center gap-1.5">
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-white font-black ${
                compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
              }`}
              style={{ color: palette.pillTextColor }}
            >
              3
            </span>
            <svg
              viewBox="0 0 28 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 ${compact ? "h-7 w-7" : "h-9 w-9"}`}
              aria-hidden="true"
            >
              <path d="M3 16.5h13.5a6 6 0 0 1-5.5 6H8.5a6 6 0 0 1-5.5-6z" />
              <path d="M5 16.5c1.5-2.2 7.5-2.2 9.5 0" />
              <path d="M18 11.5h6l-1.2 11h-3.6L18 11.5z" />
              <path d="M7.5 11.5c0-1.4 1.2-1.8 1.2-3.2M11.5 11.5c0-1.4 1.2-1.8 1.2-3.2" />
            </svg>
            <div className="leading-none">
              <div
                className={`font-black uppercase tracking-tight ${
                  compact ? "text-[10px]" : "text-xs"
                }`}
              >
                PESANAN
              </div>
              <span
                className={`inline-block rounded bg-white font-black uppercase tracking-wide mt-0.5 ${
                  compact
                    ? "px-1.5 py-0.5 text-[10px]"
                    : "px-2 py-0.5 text-xs"
                }`}
                style={{ color: palette.pillTextColor }}
              >
                DIANTAR
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Footer: Badge QR Order & Peringatan (Kiri) + MEJA NO Besar (Kanan) */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl bg-white font-black tracking-tight shadow-sm ${
              compact ? "h-8 px-2 text-[9px]" : "h-10 px-2.5 text-[11px]"
            }`}
            style={{ color: "#0F172A" }}
          >
            QR ORDER
          </div>
          <p
            className={`font-bold leading-[1.15] ${
              compact ? "text-[9px]" : "text-[11px]"
            }`}
          >
            Apabila sudah order
            <br />
            MOHON UNTUK TIDAK
            <br />
            PINDAH MEJA
          </p>
        </div>

        <div className="text-right leading-none shrink-0">
          <div
            className={`font-extrabold uppercase tracking-wider mb-0.5 ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            MEJA NO
          </div>
          <div
            className={`font-black leading-[0.82] tracking-tighter ${
              compact ? "text-[38px]" : "text-[56px]"
            }`}
            style={{
              color: "#FFFFFF",
              WebkitTextStroke: `${strokeWidthPx} ${palette.outlineHex}`,
              paintOrder: "stroke fill",
              textShadow: `0 3px 0 ${palette.outlineHex}`,
            }}
          >
            {formattedTableNo}
          </div>
        </div>
      </div>
    </div>
  );
}
