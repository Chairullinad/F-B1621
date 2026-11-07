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

