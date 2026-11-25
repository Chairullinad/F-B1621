export interface LandingBannerItem {
  id: string;
  imageUrl: string;
  caption?: string;
}

export interface OutletView {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  receiptFooter: string | null;
  logoUrl: string;
  themeColor: string;
  isActive: boolean;
  orderExpiryMinutes: number;
  taxEnabled: boolean;
  taxPercent: number | null;
  serviceEnabled: boolean;
  servicePercent: number | null;
  createdAt: string;
  landingBanners: LandingBannerItem[];
  landingNewsTitle: string;
  landingNewsBannerUrl: string | null;
  operatingHours: string;
  landingTagline: string | null;
  partnershipUrl: string | null;
  reservationUrl: string | null;
  feedbackUrl: string | null;
}

export const OUTLET_CHART_FALLBACK_PALETTE = [
  "#0284C7", // Sky Blue
  "#E11D48", // Rose
  "#059669", // Emerald
  "#D97706", // Amber
  "#7C3AED", // Violet
  "#0D9488", // Teal
  "#DB2777", // Pink
  "#4F46E5", // Indigo
  "#EA580C", // Orange
  "#16A34A", // Green
] as const;

interface LegacyReceiptMeta {
  description?: string;
  themeColor?: string;
  logoUrl?: string;
  phone?: string | null;
  receiptFooter?: string | null;
}

/**
 * Memeriksa apakah tautan tombol aksi eksternal (Kerjasama, Reservasi, Kritik & Saran)
 * menggunakan protokol yang aman (http/https/mailto/tel).
 */
export function isSafeActionLinkUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  );
}

/**
 * Membersihkan tautan aksi eksternal sebelum disimpan atau dirender ke DOM.
 */
export function sanitizeActionLinkUrl(
  rawUrl: unknown
): string | null {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  return isSafeActionLinkUrl(trimmed) ? trimmed : null;
}

/**
 * Memetakan array banner iklan JSONB atau fallback `cover_banner_url` menjadi array bersih.
 */
export function parseLandingBanners(
  rawBanners: unknown,
  fallbackCoverBanner?: unknown
): LandingBannerItem[] {
  const result: LandingBannerItem[] = [];

  if (Array.isArray(rawBanners)) {
    for (let idx = 0; idx < rawBanners.length; idx++) {
      const entry = rawBanners[idx];
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      const imageUrl =
        typeof obj.imageUrl === "string" ? obj.imageUrl.trim() : "";
      if (!imageUrl) continue;
      const id =
        typeof obj.id === "string" && obj.id.trim().length > 0
          ? obj.id.trim()
          : `banner-${idx + 1}`;
      const caption =
        typeof obj.caption === "string" && obj.caption.trim().length > 0
          ? obj.caption.trim()
          : undefined;
      result.push({ id, imageUrl, caption });
    }
  }

  if (
    result.length === 0 &&
    typeof fallbackCoverBanner === "string" &&
    fallbackCoverBanner.trim().length > 0
  ) {
    result.push({
      id: "cover-default",
      imageUrl: fallbackCoverBanner.trim(),
    });
  }

  return result;
}

/**
 * Memetakan baris tabel `public.outlets` ke tipe `OutletView`,
 * dengan fallback aman untuk data lama yang masih menyimpan JSON di `receipt_footer`.
 */
export function mapOutletRowToView(raw: Record<string, unknown>): OutletView {
  const rawFooter =
    typeof raw.receipt_footer === "string" ? raw.receipt_footer : null;
  let legacyMeta: LegacyReceiptMeta = {};
  let cleanFooter: string | null = rawFooter;

  if (rawFooter && rawFooter.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawFooter) as LegacyReceiptMeta;
      legacyMeta = parsed;
      cleanFooter = parsed.receiptFooter ?? null;
    } catch {
      // Biarkan cleanFooter apa adanya bila bukan JSON valid
    }
  }

  const rawLogo =
    typeof raw.logo_url === "string" && raw.logo_url.trim().length > 0
      ? raw.logo_url.trim()
      : null;
  const rawTheme =
    typeof raw.theme_color === "string" && raw.theme_color.trim().length > 0
      ? raw.theme_color.trim()
      : null;
  const rawDesc =
    typeof raw.description === "string" && raw.description.trim().length > 0
      ? raw.description.trim()
      : null;
  const rawPhone =
    typeof raw.phone === "string" && raw.phone.trim().length > 0
      ? raw.phone.trim()
      : null;

  const rawNewsTitle =
    typeof raw.landing_news_title === "string" &&
    raw.landing_news_title.trim().length > 0
      ? raw.landing_news_title.trim()
      : "PROMO & BERITA";
  const rawNewsBanner =
    typeof raw.landing_news_banner_url === "string" &&
    raw.landing_news_banner_url.trim().length > 0
      ? raw.landing_news_banner_url.trim()
      : null;
  const rawHours =
    typeof raw.operating_hours === "string" &&
    raw.operating_hours.trim().length > 0
      ? raw.operating_hours.trim()
      : "08.00 - 22.00 WIB";
  const rawTagline =
    typeof raw.landing_tagline === "string" &&
    raw.landing_tagline.trim().length > 0
      ? raw.landing_tagline.trim()
      : null;

  return {
    id: String(raw.id),
    name: String(raw.name ?? "Kios"),
    address: typeof raw.address === "string" ? raw.address : null,
    phone: rawPhone ?? legacyMeta.phone ?? null,
    description:
      rawDesc ?? legacyMeta.description ?? "Usaha Kuliner F&B",
    receiptFooter: cleanFooter,
    logoUrl: rawLogo ?? legacyMeta.logoUrl ?? "/logo-1621group-stacked.png",
    themeColor: rawTheme ?? legacyMeta.themeColor ?? "#0284C7",
    isActive: raw.deleted_at == null && raw.is_active !== false,
    orderExpiryMinutes: Number(raw.order_expiry_minutes ?? 15),
    taxEnabled: Boolean(raw.tax_enabled),
    taxPercent:
      raw.tax_percent !== null && raw.tax_percent !== undefined
        ? Number(raw.tax_percent)
        : null,
    serviceEnabled: Boolean(raw.service_enabled),
    servicePercent:
      raw.service_percent !== null && raw.service_percent !== undefined
        ? Number(raw.service_percent)
        : null,
    createdAt: String(raw.created_at ?? ""),
    landingBanners: parseLandingBanners(
      raw.landing_banners,
      raw.cover_banner_url
    ),
    landingNewsTitle: rawNewsTitle,
    landingNewsBannerUrl: rawNewsBanner,
    operatingHours: rawHours,
    landingTagline: rawTagline,
    partnershipUrl: sanitizeActionLinkUrl(raw.partnership_url),
    reservationUrl: sanitizeActionLinkUrl(raw.reservation_url),
    feedbackUrl: sanitizeActionLinkUrl(raw.feedback_url),
  };
}

/**
 * Memastikan setiap kios pada grafik bulanan mendapat warna yang unik dan mudah dibedakan.
 */
export function assignDistinctOutletColors(
  outlets: ReadonlyArray<Pick<OutletView, "id" | "themeColor">>
): Map<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();

  for (const outlet of outlets) {
    const preferred = outlet.themeColor?.trim();
    const normalizedPreferred = preferred?.toLowerCase() ?? "";
    const isValidHex = /^#[0-9a-f]{6}$/i.test(normalizedPreferred);

    if (isValidHex && !used.has(normalizedPreferred)) {
      used.add(normalizedPreferred);
      result.set(outlet.id, preferred);
      continue;
    }

    const nextAvailable =
      OUTLET_CHART_FALLBACK_PALETTE.find(
        (c) => !used.has(c.toLowerCase())
      ) ?? "#0284C7";
    used.add(nextAvailable.toLowerCase());
    result.set(outlet.id, nextAvailable);
  }

  return result;
}
