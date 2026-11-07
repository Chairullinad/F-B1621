-- ============================================================================
-- MIGRATION 0005: Server-Side Order Expiry Job (15 Menit)
-- Sesuai PRD Bagian 5.3, 10, dan 11 (Tahap 7):
-- - Order berstatus PENDING yang melewati expires_at (15 menit) otomatis
--   diubah menjadi EXPIRED oleh job di sisi server/database.
-- - Perubahan tercatat di audit_logs lewat trigger dengan konteks sistem.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_overdue_pending_orders()
RETURNS TABLE (
  expired_count integer,
  expired_order_ids uuid[],
  expired_order_nos text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_nos text[];
BEGIN
  -- Set konteks audit untuk eksekusi job otomatis sistem
  PERFORM public.set_audit_context(
    NULL,
    'system',
    'server-expiry-job',
    '127.0.0.1',
    'Kedaluwarsa otomatis 15 menit tanpa pembayaran/verifikasi kasir'
  );

  WITH updated_rows AS (
    UPDATE public.orders
       SET status = 'expired'
     WHERE status = 'pending'
       AND deleted_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at <= now()
    RETURNING id, order_no
  )
  SELECT
    COALESCE(array_agg(id), ARRAY[]::uuid[]),
    COALESCE(array_agg(order_no), ARRAY[]::text[])
  INTO v_ids, v_nos
  FROM updated_rows;

  RETURN QUERY SELECT
    COALESCE(array_length(v_ids, 1), 0)::integer,
    v_ids,
    v_nos;
END;
$$;

-- Izinkan pemanggilan fungsi oleh service_role dan authenticated staff
REVOKE ALL ON FUNCTION public.expire_overdue_pending_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_pending_orders() TO service_role, authenticated;

-- Jika ekstensi pg_cron aktif di project Supabase, daftarkan jadwal tiap 1 menit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'pos-1621-expire-pending-orders',
      '* * * * *',
      $cron$SELECT public.expire_overdue_pending_orders();$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Abaikan bila pg_cron belum diaktifkan pada instance Supabase
    NULL;
END;
$$;
