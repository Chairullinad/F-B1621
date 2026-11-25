-- ============================================================================
-- Migration: 20261107000011_product_addons.sql
-- Deskripsi: Fitur Add-On / Varian Pilihan Menu (misal Level Kepedasan,
--            Level Gula, Tambahan Topping) beserta assignment per produk,
--            snapshot pada order_items, RLS ketat, dan trigger audit trail.
-- ============================================================================

-- 1. Grup Add-On per Outlet (contoh: Level Kepedasan, Level Gula, Topping)
CREATE TABLE IF NOT EXISTS public.product_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  selection_type text NOT NULL DEFAULT 'single' CHECK (selection_type IN ('single', 'multiple')),
  is_required boolean NOT NULL DEFAULT false,
  max_select integer NULL CHECK (max_select IS NULL OR max_select >= 1),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_addon_groups_outlet
  ON public.product_addon_groups(outlet_id, sort_order)
  WHERE deleted_at IS NULL;

-- 2. Daftar Opsi di dalam tiap Grup Add-On (harga tambahan integer Rupiah)
CREATE TABLE IF NOT EXISTS public.product_addon_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.product_addon_groups(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price_delta integer NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_addon_options_group
  ON public.product_addon_options(group_id, sort_order)
  WHERE deleted_at IS NULL;

-- 3. Pemetaan Menu <-> Grup Add-On (hanya menu tertentu yang menggunakan add-on)
CREATE TABLE IF NOT EXISTS public.product_addon_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  addon_group_id uuid NOT NULL REFERENCES public.product_addon_groups(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_addon_assignments_unique UNIQUE (product_id, addon_group_id)
);

CREATE INDEX IF NOT EXISTS idx_addon_assignments_product
  ON public.product_addon_assignments(product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_addon_assignments_group
  ON public.product_addon_assignments(addon_group_id);

-- 4. Kolom snapshot terstruktur add-on pada order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS addons_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 5. RLS & Keamanan
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_groups FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_addon_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_options FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_addon_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_assignments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_addon_groups FROM anon;
REVOKE ALL ON public.product_addon_options FROM anon;
REVOKE ALL ON public.product_addon_assignments FROM anon;

DROP POLICY IF EXISTS addon_groups_select_staff ON public.product_addon_groups;
CREATE POLICY addon_groups_select_staff
  ON public.product_addon_groups
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      outlet_id = public.current_user_outlet_id()
      OR public.current_user_role() = 'owner'
    )
  );

DROP POLICY IF EXISTS addon_groups_write_owner ON public.product_addon_groups;
CREATE POLICY addon_groups_write_owner
  ON public.product_addon_groups
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

DROP POLICY IF EXISTS addon_options_select_staff ON public.product_addon_options;
CREATE POLICY addon_options_select_staff
  ON public.product_addon_options
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      outlet_id = public.current_user_outlet_id()
      OR public.current_user_role() = 'owner'
    )
  );

DROP POLICY IF EXISTS addon_options_write_owner ON public.product_addon_options;
CREATE POLICY addon_options_write_owner
  ON public.product_addon_options
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

DROP POLICY IF EXISTS addon_assignments_select_staff ON public.product_addon_assignments;
CREATE POLICY addon_assignments_select_staff
  ON public.product_addon_assignments
  FOR SELECT
  TO authenticated
  USING (
    outlet_id = public.current_user_outlet_id()
    OR public.current_user_role() = 'owner'
  );

DROP POLICY IF EXISTS addon_assignments_write_owner ON public.product_addon_assignments;
CREATE POLICY addon_assignments_write_owner
  ON public.product_addon_assignments
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

-- 6. Audit Trail Triggers
DROP TRIGGER IF EXISTS trg_audit_product_addon_groups ON public.product_addon_groups;
CREATE TRIGGER trg_audit_product_addon_groups
  AFTER INSERT OR UPDATE OR DELETE ON public.product_addon_groups
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_product_addon_options ON public.product_addon_options;
CREATE TRIGGER trg_audit_product_addon_options
  AFTER INSERT OR UPDATE OR DELETE ON public.product_addon_options
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_product_addon_assignments ON public.product_addon_assignments;
CREATE TRIGGER trg_audit_product_addon_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.product_addon_assignments
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();
