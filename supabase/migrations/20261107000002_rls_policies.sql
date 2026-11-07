-- ============================================================================
-- Migration: 20261107000002_rls_policies.sql
-- Deskripsi: Row Level Security (RLS) untuk seluruh tabel dan role
--            (owner, cashier, kitchen, waiter).
--            Pelanggan (anon) TIDAK memiliki akses langsung ke tabel mana pun.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AKTIFKAN RLS DI SEMUA TABEL
-- ----------------------------------------------------------------------------
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables FORCE ROW LEVEL SECURITY;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- Cabut akses langsung dari role anon (pelanggan wajib lewat endpoint/RPC server)
REVOKE ALL ON public.outlets FROM anon;
REVOKE ALL ON public.notification_settings FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.tables FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.refunds FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;

-- ----------------------------------------------------------------------------
-- 2. FUNGSI HELPER SECURITY DEFINER UNTUK CEK OUTLET & ROLE STAF AKTIF
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_outlet_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.outlet_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
    AND p.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
    AND p.deleted_at IS NULL
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 3. POLICIES: outlets
-- Semua staf aktif di outlet dapat membaca; hanya Owner yang dapat mengubah.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS outlets_select_staff ON public.outlets;
CREATE POLICY outlets_select_staff
  ON public.outlets
  FOR SELECT
  TO authenticated
  USING (
    id = public.current_user_outlet_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS outlets_update_owner ON public.outlets;
CREATE POLICY outlets_update_owner
  ON public.outlets
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  )
  WITH CHECK (
    id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

-- ----------------------------------------------------------------------------
-- 4. POLICIES: notification_settings (Hanya Owner)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_settings_select_owner ON public.notification_settings;
CREATE POLICY notification_settings_select_owner
  ON public.notification_settings
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS notification_settings_insert_owner ON public.notification_settings;
CREATE POLICY notification_settings_insert_owner
  ON public.notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS notification_settings_update_owner ON public.notification_settings;
CREATE POLICY notification_settings_update_owner
  ON public.notification_settings
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

-- ----------------------------------------------------------------------------
-- 5. POLICIES: profiles
-- Staf dapat membaca profil di outletnya; hanya Owner yang dapat menambah/mengubah.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_same_outlet ON public.profiles;
CREATE POLICY profiles_select_same_outlet
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR outlet_id = public.current_user_outlet_id()
  );

DROP POLICY IF EXISTS profiles_insert_owner ON public.profiles;
CREATE POLICY profiles_insert_owner
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS profiles_update_owner ON public.profiles;
CREATE POLICY profiles_update_owner
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

-- ----------------------------------------------------------------------------
-- 6. POLICIES: categories & products
-- Staf aktif di outlet dapat membaca; hanya Owner yang dapat menambah/mengubah.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS categories_select_staff ON public.categories;
CREATE POLICY categories_select_staff
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS categories_insert_owner ON public.categories;
CREATE POLICY categories_insert_owner
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS categories_update_owner ON public.categories;
CREATE POLICY categories_update_owner
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS products_select_staff ON public.products;
CREATE POLICY products_select_staff
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS products_insert_owner ON public.products;
CREATE POLICY products_insert_owner
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS products_update_owner ON public.products;
CREATE POLICY products_update_owner
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

-- ----------------------------------------------------------------------------
-- 7. POLICIES: tables
-- Semua staf aktif di outlet dapat melihat daftar meja; hanya Owner yang mengelola.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS tables_select_staff ON public.tables;
CREATE POLICY tables_select_staff
  ON public.tables
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS tables_insert_owner ON public.tables;
CREATE POLICY tables_insert_owner
  ON public.tables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS tables_update_owner ON public.tables;
CREATE POLICY tables_update_owner
  ON public.tables
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'owner'
  );

-- ----------------------------------------------------------------------------
-- 8. POLICIES: orders
-- - Owner & Cashier: akses penuh sesuai aturan bisnis pada outletnya.
-- - Kitchen: hanya melihat order PAID, READY, atau CANCELLED (yang pernah PAID),
--            dan hanya boleh mengubah status PAID -> READY.
-- - Waiter: hanya melihat order READY atau SERVED, dan hanya boleh mengubah
--           status READY -> SERVED.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_select_by_role ON public.orders;
CREATE POLICY orders_select_by_role
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND deleted_at IS NULL
    AND (
      public.current_user_role() IN ('owner', 'cashier')
      OR (
        public.current_user_role() = 'kitchen'
        AND (
          status IN ('paid', 'ready')
          OR (status = 'cancelled' AND paid_at IS NOT NULL)
        )
      )
      OR (
        public.current_user_role() = 'waiter'
        AND status IN ('ready', 'served')
      )
    )
  );

DROP POLICY IF EXISTS orders_insert_cashier_owner ON public.orders;
CREATE POLICY orders_insert_cashier_owner
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() IN ('owner', 'cashier')
  );

DROP POLICY IF EXISTS orders_update_cashier_owner ON public.orders;
CREATE POLICY orders_update_cashier_owner
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() IN ('owner', 'cashier')
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() IN ('owner', 'cashier')
  );

DROP POLICY IF EXISTS orders_update_kitchen_ready ON public.orders;
CREATE POLICY orders_update_kitchen_ready
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'kitchen'
    AND status = 'paid'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'kitchen'
    AND status = 'ready'
  );

DROP POLICY IF EXISTS orders_update_waiter_served ON public.orders;
CREATE POLICY orders_update_waiter_served
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'waiter'
    AND status = 'ready'
  )
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    AND public.current_user_role() = 'waiter'
    AND status = 'served'
  );

-- ----------------------------------------------------------------------------
-- 9. POLICIES: order_items
-- - SELECT: semua staf yang berhak melihat order induknya.
-- - INSERT/UPDATE/DELETE: hanya Kasir & Owner (dan dijaga trigger hanya saat PENDING).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS order_items_select_staff ON public.order_items;
CREATE POLICY order_items_select_staff
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id = public.current_user_outlet_id()
        AND o.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS order_items_insert_cashier_owner ON public.order_items;
CREATE POLICY order_items_insert_cashier_owner
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('owner', 'cashier')
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id = public.current_user_outlet_id()
        AND o.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS order_items_update_cashier_owner ON public.order_items;
CREATE POLICY order_items_update_cashier_owner
  ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('owner', 'cashier')
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id = public.current_user_outlet_id()
        AND o.status = 'pending'
        AND o.deleted_at IS NULL
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('owner', 'cashier')
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id = public.current_user_outlet_id()
        AND o.status = 'pending'
        AND o.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS order_items_delete_cashier_owner ON public.order_items;
CREATE POLICY order_items_delete_cashier_owner
  ON public.order_items
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() IN ('owner', 'cashier')
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id = public.current_user_outlet_id()
        AND o.status = 'pending'
        AND o.deleted_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- 10. POLICIES: payments & refunds
-- Hanya Kasir & Owner di outletnya. Dapur & Pelayan tidak melihat data pembayaran.
-- Tidak ada UPDATE atau DELETE.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_select_cashier_owner ON public.payments;
CREATE POLICY payments_select_cashier_owner
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('owner', 'cashier')
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.outlet_id = public.current_user_outlet_id()
    )
  );

DROP POLICY IF EXISTS payments_insert_cashier_owner ON public.payments;
CREATE POLICY payments_insert_cashier_owner
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('owner', 'cashier')
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.outlet_id = public.current_user_outlet_id()
    )
  );

DROP POLICY IF EXISTS refunds_select_cashier_owner ON public.refunds;
CREATE POLICY refunds_select_cashier_owner
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('owner', 'cashier')
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = refunds.order_id
        AND o.outlet_id = public.current_user_outlet_id()
    )
  );

DROP POLICY IF EXISTS refunds_insert_cashier_owner ON public.refunds;
CREATE POLICY refunds_insert_cashier_owner
  ON public.refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('owner', 'cashier')
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = refunds.order_id
        AND o.outlet_id = public.current_user_outlet_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 11. POLICIES: audit_logs (APPEND-ONLY)
-- - SELECT: Hanya Owner di outletnya.
-- - INSERT: Diizinkan bagi user terautentikasi / trigger di outletnya.
-- - UPDATE & DELETE: Ditolak mutlak (USING false) untuk semua role termasuk Owner.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_select_owner ON public.audit_logs;
CREATE POLICY audit_logs_select_owner
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'owner'
    AND (
      outlet_id = public.current_user_outlet_id()
      OR outlet_id IS NULL
    )
  );

DROP POLICY IF EXISTS audit_logs_insert_append_only ON public.audit_logs;
CREATE POLICY audit_logs_insert_append_only
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id IS NULL
    OR outlet_id = public.current_user_outlet_id()
  );

DROP POLICY IF EXISTS audit_logs_block_update ON public.audit_logs;
CREATE POLICY audit_logs_block_update
  ON public.audit_logs
  FOR UPDATE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS audit_logs_block_delete ON public.audit_logs;
CREATE POLICY audit_logs_block_delete
  ON public.audit_logs
  FOR DELETE
  TO authenticated, anon
  USING (false);
