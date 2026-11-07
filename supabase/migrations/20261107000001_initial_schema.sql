-- ============================================================================
-- Migration: 20261107000001_initial_schema.sql
-- Deskripsi: Skema database lengkap POS F&B Web sesuai Bagian 7 & 8 PRD.md
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('owner', 'cashier', 'kitchen', 'waiter');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source') THEN
    CREATE TYPE public.order_source AS ENUM ('customer_qr', 'cashier');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN
    CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeaway');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending',
      'paid',
      'ready',
      'served',
      'expired',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('cash');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_reason_category') THEN
    CREATE TYPE public.refund_reason_category AS ENUM ('outlet_fault', 'other');
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. TABEL: outlets
-- Pajak dan service charge mati secara default, persentase kosong (NULL).
-- Saklar tidak bisa dinyalakan sebelum persentase diisi.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  address text NULL,
  receipt_footer text NULL,
  order_expiry_minutes integer NOT NULL DEFAULT 15 CHECK (order_expiry_minutes > 0 AND order_expiry_minutes <= 120),
  tax_enabled boolean NOT NULL DEFAULT false,
  tax_percent numeric(5,2) NULL CHECK (tax_percent IS NULL OR (tax_percent > 0 AND tax_percent <= 100)),
  service_enabled boolean NOT NULL DEFAULT false,
  service_percent numeric(5,2) NULL CHECK (service_percent IS NULL OR (service_percent > 0 AND service_percent <= 100)),
  price_includes_tax boolean NOT NULL DEFAULT false,
  max_cashier_discount_percent numeric(5,2) NULL CHECK (
    max_cashier_discount_percent IS NULL OR (max_cashier_discount_percent >= 0 AND max_cashier_discount_percent <= 100)
  ),
  max_cashier_discount_amount integer NULL CHECK (
    max_cashier_discount_amount IS NULL OR max_cashier_discount_amount >= 0
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT outlets_tax_switch_requires_percent CHECK (
    NOT tax_enabled OR tax_percent IS NOT NULL
  ),
  CONSTRAINT outlets_service_switch_requires_percent CHECK (
    NOT service_enabled OR service_percent IS NOT NULL
  )
);

-- ----------------------------------------------------------------------------
-- 3. TABEL: notification_settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL UNIQUE REFERENCES public.outlets(id) ON DELETE RESTRICT,
  owner_email text NULL,
  monthly_report_enabled boolean NOT NULL DEFAULT false,
  instant_events jsonb NOT NULL DEFAULT '{"refund": false, "paid_cancellation": false, "discount": false, "price_or_setting_change": false}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. TABEL: profiles (staf: owner, cashier, kitchen, waiter)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  role public.user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_outlet_role
  ON public.profiles(outlet_id, role)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 5. TABEL: categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_outlet_sort
  ON public.categories(outlet_id, sort_order)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 6. TABEL: products
-- Harga wajib bilangan bulat Rupiah (integer >= 0).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price integer NOT NULL CHECK (price >= 0),
  image_url text NULL,
  is_available boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_products_outlet_category
  ON public.products(outlet_id, category_id)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 7. TABEL: tables (100 meja per outlet dengan qr_token acak & unik)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  table_no integer NOT NULL CHECK (table_no >= 1 AND table_no <= 1000),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  qr_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT tables_outlet_table_no_unique UNIQUE (outlet_id, table_no),
  CONSTRAINT tables_qr_token_min_length CHECK (length(qr_token) >= 32)
);

CREATE INDEX IF NOT EXISTS idx_tables_qr_token
  ON public.tables(qr_token)
  WHERE deleted_at IS NULL AND is_active = true;

-- ----------------------------------------------------------------------------
-- 8. TABEL: orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  order_no text NOT NULL CHECK (length(trim(order_no)) > 0),
  source public.order_source NOT NULL,
  order_type public.order_type NOT NULL,
  table_id uuid NULL REFERENCES public.tables(id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal integer NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount integer NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= subtotal),
  discount_reason text NULL,
  service_rate numeric(5,2) NULL CHECK (service_rate IS NULL OR (service_rate > 0 AND service_rate <= 100)),
  service_amount integer NOT NULL DEFAULT 0 CHECK (service_amount >= 0),
  tax_rate numeric(5,2) NULL CHECK (tax_rate IS NULL OR (tax_rate > 0 AND tax_rate <= 100)),
  tax_amount integer NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  price_includes_tax boolean NOT NULL DEFAULT false,
  total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  idempotency_key text NULL UNIQUE,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz NULL,
  ready_at timestamptz NULL,
  served_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  paid_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  served_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancelled_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancel_reason text NULL,
  deleted_at timestamptz NULL,
  CONSTRAINT orders_outlet_order_no_unique UNIQUE (outlet_id, order_no),
  CONSTRAINT orders_dine_in_requires_table CHECK (
    order_type = 'takeaway' OR table_id IS NOT NULL
  ),
  CONSTRAINT orders_discount_requires_reason CHECK (
    discount = 0 OR (discount_reason IS NOT NULL AND length(trim(discount_reason)) > 0)
  ),
  CONSTRAINT orders_cancelled_requires_reason CHECK (
    status <> 'cancelled' OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created
  ON public.orders(outlet_id, status, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pending_expires
  ON public.orders(expires_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_table_status
  ON public.orders(table_id, status)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 9. TABEL: order_items (Snapshot nama dan harga produk saat order dibuat)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL CHECK (length(trim(product_name)) > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  qty integer NOT NULL CHECK (qty > 0 AND qty <= 100),
  note text NULL,
  line_total integer NOT NULL CHECK (line_total = unit_price * qty),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items(order_id);

-- ----------------------------------------------------------------------------
-- 10. TABEL: payments
-- UNIQUE (order_id) menjamin hanya satu pembayaran sah per order di database.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  method public.payment_method NOT NULL DEFAULT 'cash',
  amount_received integer NOT NULL CHECK (amount_received >= 0),
  change_amount integer NOT NULL CHECK (change_amount >= 0),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_change_valid CHECK (amount_received >= change_amount)
);

-- ----------------------------------------------------------------------------
-- 11. TABEL: refunds
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount > 0),
  reason_category public.refund_reason_category NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 12. TABEL: audit_logs (APPEND-ONLY)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  outlet_id uuid NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  user_id uuid NULL,
  role text NULL,
  device text NULL,
  ip text NULL,
  action text NOT NULL CHECK (length(trim(action)) > 0),
  entity text NOT NULL CHECK (length(trim(entity)) > 0),
  entity_id text NOT NULL CHECK (length(trim(entity_id)) > 0),
  before jsonb NULL,
  after jsonb NULL,
  reason text NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_outlet_created
  ON public.audit_logs(outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity, entity_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 13. TRIGGER HELPER: updated_at otomatis & blokir hard delete
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete pada tabel % dilarang oleh aturan bisnis. Gunakan soft delete (deleted_at).', TG_TABLE_NAME;
END;
$$;

-- Pasang trigger updated_at
DROP TRIGGER IF EXISTS trg_outlets_updated_at ON public.outlets;
CREATE TRIGGER trg_outlets_updated_at
  BEFORE UPDATE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_tables_updated_at ON public.tables;
CREATE TRIGGER trg_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON public.order_items;
CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Pasang trigger larangan hard delete pada tabel bisnis utama
DROP TRIGGER IF EXISTS trg_prevent_delete_outlets ON public.outlets;
CREATE TRIGGER trg_prevent_delete_outlets
  BEFORE DELETE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_profiles ON public.profiles;
CREATE TRIGGER trg_prevent_delete_profiles
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_categories ON public.categories;
CREATE TRIGGER trg_prevent_delete_categories
  BEFORE DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_products ON public.products;
CREATE TRIGGER trg_prevent_delete_products
  BEFORE DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_tables ON public.tables;
CREATE TRIGGER trg_prevent_delete_tables
  BEFORE DELETE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_orders ON public.orders;
CREATE TRIGGER trg_prevent_delete_orders
  BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_payments ON public.payments;
CREATE TRIGGER trg_prevent_delete_payments
  BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_refunds ON public.refunds;
CREATE TRIGGER trg_prevent_delete_refunds
  BEFORE DELETE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

-- ----------------------------------------------------------------------------
-- 14. TRIGGER ATURAN BISNIS ORDER & ORDER_ITEMS
-- - Order PAID tidak bisa diedit nominal/item-nya.
-- - Revisi order_items hanya boleh saat status order = 'pending'.
-- - Order SERVED hanya bisa dibatalkan oleh Owner.
-- - Optimistic locking: version naik otomatis setiap UPDATE pada orders.
-- ----------------------------------------------------------------------------
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

  -- Naikkan version secara otomatis untuk optimistic locking
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_business_rules ON public.orders;
CREATE TRIGGER trg_enforce_order_business_rules
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_business_rules();

CREATE OR REPLACE FUNCTION public.enforce_order_items_editable_only_when_pending()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_status public.order_status;
  v_order_source public.order_source;
  v_order_created_at timestamptz;
  v_target_order_id uuid;
BEGIN
  v_target_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;

  SELECT status, source, created_at
    INTO v_order_status, v_order_source, v_order_created_at
  FROM public.orders
  WHERE id = v_target_order_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order induk tidak ditemukan.';
  END IF;

  -- Izinkan INSERT item saat pembuatan order manual oleh kasir dalam transaksi yang sama
  IF TG_OP = 'INSERT'
     AND v_order_status = 'paid'
     AND v_order_source = 'cashier'
     AND v_order_created_at = now()
  THEN
    RETURN NEW;
  END IF;

  IF v_order_status <> 'pending' THEN
    RAISE EXCEPTION 'Item order hanya dapat diubah atau dihapus saat status order masih PENDING (status saat ini: %).', v_order_status;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_items_pending ON public.order_items;
CREATE TRIGGER trg_enforce_order_items_pending
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_items_editable_only_when_pending();
