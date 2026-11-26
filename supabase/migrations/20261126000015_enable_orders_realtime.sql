-- ============================================================================
-- Migrasi 015: Aktifkan Supabase Realtime untuk tabel orders
-- Deskripsi:
-- - Menjamin REPLICA IDENTITY FULL pada public.orders agar payload OLD/NEW & filter outlet_id bekerja penuh.
-- - Menambahkan public.orders ke publikasi supabase_realtime secara idempoten.
-- ============================================================================

ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END
$$;
