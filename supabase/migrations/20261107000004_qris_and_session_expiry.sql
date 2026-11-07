-- ============================================================================
-- Migration: 20261107000004_qris_and_session_expiry.sql
-- Deskripsi:
-- 1. Menambahkan metode pembayaran 'qris' ke enum public.payment_method.
-- 2. Menambahkan pengaturan QRIS statis (qris_enabled, qris_raw_payload,
--    qris_merchant_name) ke tabel public.outlets.
-- 3. Menambahkan kolom payment_choice, customer_claimed_paid_at, dan
--    tracking_expired_at ke tabel public.orders.
-- 4. Mengatur tracking_expired_at otomatis saat order berstatus SERVED,
--    EXPIRED, atau CANCELLED agar sesi halaman pelanggan tertutup otomatis.
-- ============================================================================

-- 1. Tambahkan nilai 'qris' pada enum payment_method
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'qris';

-- 2. Kolom pengaturan QRIS pada tabel outlets
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS qris_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qris_raw_payload text NULL,
  ADD COLUMN IF NOT EXISTS qris_merchant_name text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outlets_qris_switch_requires_payload'
  ) THEN
    ALTER TABLE public.outlets
      ADD CONSTRAINT outlets_qris_switch_requires_payload CHECK (
        NOT qris_enabled OR (qris_raw_payload IS NOT NULL AND length(trim(qris_raw_payload)) > 20)
      );
  END IF;
END
$$;

-- 3. Kolom pilihan pembayaran, waktu konfirmasi pelanggan, dan kedaluwarsa sesi tracking pada orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_choice public.payment_method NOT NULL DEFAULT 'qris',
  ADD COLUMN IF NOT EXISTS customer_claimed_paid_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tracking_expired_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_orders_qris_claimed_pending
  ON public.orders(outlet_id, status, customer_claimed_paid_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- 4. Perbarui trigger enforce_order_business_rules untuk mengisi tracking_expired_at
--    secara otomatis saat order selesai disajikan (SERVED), EXPIRED, atau CANCELLED.
CREATE OR REPLACE FUNCTION public.enforce_order_business_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_role text;
BEGIN
  -- Jika hanya melakukan soft delete, izinkan
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    NEW.version := OLD.version + 1;
    RETURN NEW;
  END IF;

  -- Status final EXPIRED dan CANCELLED tidak bisa diubah lagi
  IF OLD.status IN ('expired', 'cancelled') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Order dengan status % bersifat final dan tidak dapat diubah.', OLD.status;
  END IF;

  -- Jika order sudah PAID / READY / SERVED, nominal keuangan dan meja tidak boleh diedit
  IF OLD.status IN ('paid', 'ready', 'served') THEN
    IF NEW.subtotal <> OLD.subtotal
       OR NEW.discount <> OLD.discount
       OR COALESCE(NEW.discount_reason, '') <> COALESCE(OLD.discount_reason, '')
       OR COALESCE(NEW.service_rate, -1) <> COALESCE(OLD.service_rate, -1)
       OR NEW.service_amount <> OLD.service_amount
       OR COALESCE(NEW.tax_rate, -1) <> COALESCE(OLD.tax_rate, -1)
       OR NEW.tax_amount <> OLD.tax_amount
       OR NEW.price_includes_tax <> OLD.price_includes_tax
       OR NEW.total <> OLD.total
       OR COALESCE(NEW.table_id::text, '') <> COALESCE(OLD.table_id::text, '')
    THEN
      RAISE EXCEPTION 'Order yang sudah dibayar (%) tidak dapat diedit nominal atau mejanya.', OLD.status;
    END IF;
  END IF;

  -- Aturan pembatalan order SERVED: Hanya Owner yang boleh membatalkan
  IF OLD.status = 'served' AND NEW.status = 'cancelled' THEN
    SELECT p.role::text INTO v_actor_role
    FROM public.profiles p
    WHERE p.id = COALESCE(auth.uid(), NEW.cancelled_by)
      AND p.is_active = true
      AND p.deleted_at IS NULL;

    v_actor_role := COALESCE(v_actor_role, nullif(current_setting('app.audit_role', true), ''));

    IF COALESCE(v_actor_role, '') <> 'owner' THEN
      RAISE EXCEPTION 'Order berstatus SERVED hanya dapat dibatalkan oleh Owner untuk kesalahan outlet.';
    END IF;
  END IF;

  -- Otomatis kunci/akhiri sesi pemantauan pelanggan saat order mencapai SERVED, EXPIRED, atau CANCELLED
  IF NEW.status IN ('served', 'expired', 'cancelled') AND OLD.tracking_expired_at IS NULL THEN
    NEW.tracking_expired_at := COALESCE(NEW.tracking_expired_at, now());
  END IF;

  -- Naikkan version secara otomatis untuk optimistic locking
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
