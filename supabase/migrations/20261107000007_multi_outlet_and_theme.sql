-- ============================================================================
-- Migrasi 0007: Multi-Outlet, Logo Cabang & Kustomisasi Tampilan (Theme Customizer)
-- ============================================================================

-- 1. Tambah kolom tampilan & kontak pada tabel public.outlets
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '/logo-1621.png',
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#3B7097',
  ADD COLUMN IF NOT EXISTS cover_banner_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description text DEFAULT 'Kafe & Resto Modern',
  ADD COLUMN IF NOT EXISTS phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Pastikan outlet yang sudah ada terisi nilai default logo transparan & denim blue
UPDATE public.outlets
SET
  logo_url = COALESCE(logo_url, '/logo-1621.png'),
  theme_color = COALESCE(theme_color, '#3B7097'),
  description = COALESCE(description, 'Kafe & Resto Modern')
WHERE deleted_at IS NULL;

-- 3. Policy RLS: Owner bebas INSERT cabang baru
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'outlets' AND policyname = 'outlets_owner_insert_all'
  ) THEN
    CREATE POLICY outlets_owner_insert_all ON public.outlets
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'
        )
      );
  END IF;
END $$;

