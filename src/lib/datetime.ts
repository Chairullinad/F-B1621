/**
 * src/lib/datetime.ts
 * Konvensi zona waktu: Simpan timestamp UTC (timestamptz) di database,
 * tampilkan dalam WIB (Asia/Jakarta) di seluruh UI.
 */

export const APP_TIMEZONE = "Asia/Jakarta";

export function formatDateTimeWIB(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} WIB`;
}

export function formatTimeWIB(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} WIB`;
}

export function getTodayPrefixWIB(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";

  return `${year}${month}${day}`;
}

export type FinancialPeriodKey = "month" | "today" | "7d" | "30d" | "all";

export const FINANCIAL_PERIOD_OPTIONS: ReadonlyArray<{
  key: FinancialPeriodKey;
  label: string;
}> = [
  { key: "month", label: "Bulan Ini" },
  { key: "today", label: "Hari Ini (WIB)" },
  { key: "7d", label: "7 Hari Terakhir" },
  { key: "30d", label: "30 Hari Terakhir" },
  { key: "all", label: "Semua Periode" },
];

export function normalizeFinancialPeriod(
  rawPeriod?: string | null
): FinancialPeriodKey {
  if (
    rawPeriod === "today" ||
    rawPeriod === "7d" ||
    rawPeriod === "30d" ||
    rawPeriod === "month" ||
    rawPeriod === "all"
  ) {
    return rawPeriod;
  }
  return "month";
}

function formatWibIsoDate(msWithWibOffset: number): string {
  const d = new Date(msWithWibOffset);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface WibPeriodBounds {
  period: FinancialPeriodKey;
  label: string;
  startIso: string | null;
  endIso: string | null;
  startDateWib: string | null;
  endDateWib: string | null;
}

export interface CustomWibDateRange {
  startDateWib: string;
  endDateWib: string;
  startIso: string;
  endIso: string;
  prevStartIso: string;
  prevEndIso: string;
  dayCount: number;
  label: string;
}

function parseStrictIsoDateWib(raw?: string | null): {
  year: number;
  month: number;
  day: number;
  iso: string;
} | null {
  const trimmed = raw?.trim() ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    iso: trimmed,
  };
}

/**
 * Mem-parsing tanggal tunggal atau rentang tanggal `YYYY-MM-DD` dalam WIB (UTC+7).
 * Jika hanya salah satu diisi, otomatis berlaku untuk 1 hari penuh tersebut.
 * Jika tanggal mulai > tanggal selesai, urutannya otomatis dibalik secara aman.
 */
export function parseWibDateRange(
  rawStart?: string | null,
  rawEnd?: string | null
): CustomWibDateRange | null {
  const parsedStart = parseStrictIsoDateWib(rawStart);
  const parsedEnd = parseStrictIsoDateWib(rawEnd);

  if (!parsedStart && !parsedEnd) {
    return null;
  }

  const first = parsedStart ?? parsedEnd!;
  const second = parsedEnd ?? parsedStart!;
  const [start, end] = first.iso <= second.iso ? [first, second] : [second, first];

  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const startUtcMs =
    Date.UTC(start.year, start.month - 1, start.day, 0, 0, 0, 0) - wibOffsetMs;
  const endUtcMs =
    Date.UTC(end.year, end.month - 1, end.day, 23, 59, 59, 999) - wibOffsetMs;

  const dayMs = 24 * 60 * 60 * 1000;
  const dayCount = Math.max(
    1,
    Math.round((endUtcMs + 1 - startUtcMs) / dayMs)
  );
  const prevEndUtcMs = startUtcMs - 1;
  const prevStartUtcMs = startUtcMs - dayCount * dayMs;

  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const label =
    start.iso === end.iso
      ? fmt.format(new Date(startUtcMs))
      : `${fmt.format(new Date(startUtcMs))} – ${fmt.format(new Date(endUtcMs))}`;

  return {
    startDateWib: start.iso,
    endDateWib: end.iso,
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
    prevStartIso: new Date(prevStartUtcMs).toISOString(),
    prevEndIso: new Date(prevEndUtcMs).toISOString(),
    dayCount,
    label,
  };
}

/**
 * Menghitung batas waktu WIB (UTC+7) untuk filter laporan keuangan & laba rugi.
 */
export function getWibPeriodBounds(
  period: FinancialPeriodKey,
  nowMs: number = Date.now()
): WibPeriodBounds {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWibMs = nowMs + wibOffsetMs;
  const nowWib = new Date(nowWibMs);

  const year = nowWib.getUTCFullYear();
  const month = nowWib.getUTCMonth();
  const date = nowWib.getUTCDate();

  if (period === "all") {
    return {
      period,
      label: "Semua Periode",
      startIso: null,
      endIso: null,
      startDateWib: null,
      endDateWib: null,
    };
  }

  const endWibMs = Date.UTC(year, month, date, 23, 59, 59, 999);
  const startTodayWibMs = Date.UTC(year, month, date, 0, 0, 0, 0);

  let startWibMs: number;
  let label: string;

  if (period === "month") {
    startWibMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
    label = new Date(startWibMs - wibOffsetMs).toLocaleDateString("id-ID", {
      timeZone: APP_TIMEZONE,
      month: "long",
      year: "numeric",
    });
  } else {
    const lookbackDays = period === "today" ? 0 : period === "7d" ? 6 : 29;
    startWibMs = startTodayWibMs - lookbackDays * 24 * 60 * 60 * 1000;
    label =
      period === "today"
        ? "Hari Ini (WIB)"
        : period === "7d"
          ? "7 Hari Terakhir"
          : "30 Hari Terakhir";
  }

  return {
    period,
    label,
    startIso: new Date(startWibMs - wibOffsetMs).toISOString(),
    endIso: new Date(endWibMs - wibOffsetMs).toISOString(),
    startDateWib: formatWibIsoDate(startWibMs),
    endDateWib: formatWibIsoDate(endWibMs),
  };
}

