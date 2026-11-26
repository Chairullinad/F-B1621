-- ============================================================================
-- Migrasi 0014: Tabel Pencatatan Pembatalan Pesanan & Void Item (order_void_records)
-- Mencatat seluruh pembatalan pesanan penuh (`full_order`) maupun
-- pengurangan/penghapusan item pada saat revisi/rebilling (`partial_item`).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_void_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_no text NOT NULL,
  table_name text NOT NULL DEFAULT '-',
  void_scope text NOT NULL CHECK (void_scope IN ('full_order', 'partial_item')),
  order_status_at_void text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty_before integer NOT NULL CHECK (qty_before >= 0),
  qty_after integer NOT NULL CHECK (qty_after >= 0),
  qty_cancelled integer NOT NULL CHECK (qty_cancelled > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  void_amount integer NOT NULL CHECK (void_amount >= 0),
  reason_category text NOT NULL DEFAULT 'other',
  reason text NOT NULL,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_void_records_outlet_created
  ON public.order_void_records(outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_void_records_order_id
  ON public.order_void_records(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_void_records_scope
  ON public.order_void_records(void_scope, created_at DESC);

-- Aktifkan RLS ketat & blokir akses anon
ALTER TABLE public.order_void_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_void_records FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_void_records FROM anon;
GRANT SELECT, INSERT ON TABLE public.order_void_records TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.order_void_records FROM authenticated;

DROP POLICY IF EXISTS order_void_records_select_staff ON public.order_void_records;
CREATE POLICY order_void_records_select_staff
  ON public.order_void_records
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    OR public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS order_void_records_insert_staff ON public.order_void_records;
CREATE POLICY order_void_records_insert_staff
  ON public.order_void_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id = public.current_user_outlet_id()
    OR public.current_user_role() = 'owner'
  );

-- Pasang trigger audit trail untuk setiap pencatatan void
DROP TRIGGER IF EXISTS trg_audit_order_void_records ON public.order_void_records;
CREATE TRIGGER trg_audit_order_void_records
  AFTER INSERT OR UPDATE OR DELETE ON public.order_void_records
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();
