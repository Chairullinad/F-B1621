-- ============================================================================
-- Migrasi 0009: Landing Page Pelanggan, Banner Iklan, & Link Tombol Kios
-- ============================================================================

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS landing_banners jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_news_title text NOT NULL DEFAULT 'PROMO & BERITA',
  ADD COLUMN IF NOT EXISTS landing_news_banner_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS operating_hours text NOT NULL DEFAULT '08.00 - 22.00 WIB',
  ADD COLUMN IF NOT EXISTS landing_tagline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partnership_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reservation_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feedback_url text DEFAULT NULL;

-- Backfill banner bila outlet lama sudah mengisi cover_banner_url
UPDATE public.outlets
SET landing_banners = jsonb_build_array(
  jsonb_build_object(
    'id', 'cover-initial',
    'imageUrl', cover_banner_url,
    'caption', ''
  )
)
WHERE cover_banner_url IS NOT NULL
  AND trim(cover_banner_url) <> ''
  AND jsonb_array_length(landing_banners) = 0;
