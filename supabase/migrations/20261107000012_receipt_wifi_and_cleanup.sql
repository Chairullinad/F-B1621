-- ============================================================================
-- Migrasi 0012: Pengaturan WiFi & Password Struk per Outlet + Cleanup Slogan
-- ============================================================================

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS wifi_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wifi_password text DEFAULT NULL;

-- Hapus kalimat "Take a Break, Enjoy the Brew" bila tersimpan di data outlet
UPDATE public.outlets
SET
  landing_tagline = NULLIF(
    trim(regexp_replace(COALESCE(landing_tagline, ''), 'take\s+a\s+break,?\s*enjoy\s+the\s+brew\.?', '', 'gi')),
    ''
  ),
  description = NULLIF(
    trim(regexp_replace(COALESCE(description, ''), 'take\s+a\s+break,?\s*enjoy\s+the\s+brew\.?', '', 'gi')),
    ''
  ),
  receipt_footer = NULLIF(
    trim(regexp_replace(COALESCE(receipt_footer, ''), 'take\s+a\s+break,?\s*enjoy\s+the\s+brew\.?', '', 'gi')),
    ''
  )
WHERE
  COALESCE(landing_tagline, '') ~* 'take\s+a\s+break,?\s*enjoy\s+the\s+brew'
  OR COALESCE(description, '') ~* 'take\s+a\s+break,?\s*enjoy\s+the\s+brew'
  OR COALESCE(receipt_footer, '') ~* 'take\s+a\s+break,?\s*enjoy\s+the\s+brew';
