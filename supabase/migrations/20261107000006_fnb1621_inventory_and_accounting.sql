-- ============================================================================
-- Migration: 20261107000006_fnb1621_inventory_and_accounting.sql
-- Deskripsi:
-- 1. Menambahkan role 'warehouse' (Staff Gudang) ke enum public.user_role
-- 2. Menambahkan kolom emoji & cogs_estimate pada products, cooking_started_at
--    & cogs_amount pada orders, serta cogs_unit_snapshot & cogs_line_total
--    pada order_items.
-- 3. Tabel Modul Inventory & Gudang Lengkap:
--    - ingredients (Master Bahan Baku + stok per lokasi Gudang/Dapur/Bar)
--    - product_recipes (Bill of Materials / Resep Produk)
--    - stock_movements (Kartu Stok / Riwayat Mutasi)
--    - suppliers (Master Supplier + Hutang Usaha)
--    - purchase_orders (PO Supplier)
--    - stock_opnames (Blind Count Mode + Approval Owner)
--    - waste_logs (Waste & Spoilage Tracking)
--    - stock_transfers (Transfer Stok Antar Lokasi/Gudang)
-- 4. Tabel Modul Laporan Keuangan & Akuntansi:
--    - accounting_journals (Jurnal Umum Otomatis & Manual)
-- 5. RLS Policies & Trigger Audit Trail untuk seluruh tabel baru
-- 6. Seed Data Awal f&b1621 (Bahan Baku, Resep, Supplier, PO, Opname, Waste,
--    Transfer, dan Jurnal Akuntansi)
-- ============================================================================

-- 1. Tambah role 'warehouse' pada enum public.user_role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'warehouse';

-- 2. Tambah kolom pendukung pada products, orders, dan order_items
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '🍽️',
  ADD COLUMN IF NOT EXISTS cogs_estimate integer NOT NULL DEFAULT 0 CHECK (cogs_estimate >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cooking_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cogs_amount integer NOT NULL DEFAULT 0 CHECK (cogs_amount >= 0);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cogs_unit_snapshot integer NOT NULL DEFAULT 0 CHECK (cogs_unit_snapshot >= 0),
  ADD COLUMN IF NOT EXISTS cogs_line_total integer NOT NULL DEFAULT 0 CHECK (cogs_line_total >= 0);

-- 3. Tabel: ingredients (Master Bahan Baku)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  category text NOT NULL DEFAULT 'Bahan Umum',
  unit text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'gram', 'liter', 'ml', 'pcs', 'porsi')),
  current_stock numeric(12,3) NOT NULL DEFAULT 0,
  min_stock numeric(12,3) NOT NULL DEFAULT 0,
  unit_cost integer NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  storage_stock jsonb NOT NULL DEFAULT '{"gudang": 0, "dapur": 0, "bar": 0}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_ingredients_outlet
  ON public.ingredients(outlet_id)
  WHERE deleted_at IS NULL;

-- 4. Tabel: product_recipes (Resep Produk / BOM)
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  qty_per_portion numeric(12,3) NOT NULL CHECK (qty_per_portion > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product
  ON public.product_recipes(product_id);

-- 5. Tabel: stock_movements (Kartu Stok / Riwayat Mutasi)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (
    movement_type IN (
      'sale_deduct',
      'refund_restore',
      'po_receive',
      'opname_adjustment',
      'waste',
      'transfer_out',
      'transfer_in',
      'manual_adjustment'
    )
  ),
  qty_delta numeric(12,3) NOT NULL,
  stock_before numeric(12,3) NOT NULL,
  stock_after numeric(12,3) NOT NULL,
  unit_cost integer NOT NULL DEFAULT 0,
  total_cost integer NOT NULL DEFAULT 0,
  reference_type text NULL,
  reference_id text NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_outlet_created
  ON public.stock_movements(outlet_id, created_at DESC);

-- 6. Tabel: suppliers (Master Supplier)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  category text NOT NULL DEFAULT 'Sembako & Bumbu',
  contact text NOT NULL DEFAULT '-',
  address text NOT NULL DEFAULT '-',
  payment_term text NOT NULL DEFAULT 'COD' CHECK (payment_term IN ('COD', '7 Hari', '14 Hari', '30 Hari')),
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  payable_balance integer NOT NULL DEFAULT 0 CHECK (payable_balance >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_outlet
  ON public.suppliers(outlet_id)
  WHERE deleted_at IS NULL;

-- 7. Tabel: purchase_orders (Purchase Order / PO Supplier)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  po_no text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_name_snapshot text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dikirim', 'diterima', 'lunas', 'cancelled')),
  items_summary text NOT NULL,
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  paid_amount integer NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes text NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at timestamptz NULL,
  paid_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_outlet_date
  ON public.purchase_orders(outlet_id, order_date DESC);

-- 8. Tabel: stock_opnames (Stock Opname Blind Count & Approval Owner)
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  opname_no text NOT NULL UNIQUE,
  opname_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting_approval', 'approved', 'rejected')),
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_variance_amount integer NOT NULL DEFAULT 0,
  notes text NULL,
  photo_evidence_note text NULL,
  digital_signature text NULL,
  submitted_by_name text NOT NULL DEFAULT 'Staff Gudang',
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_opnames_outlet_status
  ON public.stock_opnames(outlet_id, status, created_at DESC);

-- 9. Tabel: waste_logs (Waste & Spoilage Tracking)
CREATE TABLE IF NOT EXISTS public.waste_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  waste_date date NOT NULL DEFAULT CURRENT_DATE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  ingredient_name_snapshot text NOT NULL,
  qty numeric(12,3) NOT NULL CHECK (qty > 0),
  unit text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('Busuk', 'Expired', 'Tumpah', 'Rusak Produksi', 'Lainnya')),
  cost_amount integer NOT NULL CHECK (cost_amount >= 0),
  recorded_by_name text NOT NULL DEFAULT 'Staf Gudang',
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_outlet_date
  ON public.waste_logs(outlet_id, waste_date DESC);

-- 10. Tabel: stock_transfers (Transfer Stok Antar Lokasi / Unit)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  transfer_no text NOT NULL UNIQUE,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  from_location text NOT NULL CHECK (length(trim(from_location)) > 0),
  to_location text NOT NULL CHECK (length(trim(to_location)) > 0),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  ingredient_name_snapshot text NOT NULL,
  qty numeric(12,3) NOT NULL CHECK (qty > 0),
  unit text NOT NULL,
  total_value integer NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
  sender_name text NOT NULL DEFAULT 'Staff Gudang',
  receiver_name text NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_outlet_status
  ON public.stock_transfers(outlet_id, status, created_at DESC);

-- 11. Tabel: accounting_journals (Jurnal Umum Akuntansi)
CREATE TABLE IF NOT EXISTS public.accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  journal_no text NOT NULL UNIQUE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  debit_account text NOT NULL CHECK (length(trim(debit_account)) > 0),
  credit_account text NOT NULL CHECK (length(trim(credit_account)) > 0),
  amount integer NOT NULL CHECK (amount >= 0),
  source_type text NOT NULL DEFAULT 'manual' CHECK (
    source_type IN (
      'order_paid',
      'order_cogs',
      'order_refund',
      'po_received',
      'po_paid',
      'waste',
      'opname',
      'transfer',
      'expense_salary',
      'expense_rent',
      'expense_utility',
      'expense_other',
      'asset_purchase',
      'owner_capital',
      'tax_payment',
      'manual'
    )
  ),
  reference_id text NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_journals_outlet_date
  ON public.accounting_journals(outlet_id, entry_date DESC, created_at DESC);

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) UNTUK TABEL BARU
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ingredients',
    'product_recipes',
    'stock_movements',
    'suppliers',
    'purchase_orders',
    'stock_opnames',
    'waste_logs',
    'stock_transfers',
    'accounting_journals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);

    -- Semua staf aktif di outlet yang sama dapat membaca (SELECT)
    EXECUTE format('DROP POLICY IF EXISTS %I_select_staff ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_staff ON public.%I FOR SELECT TO authenticated USING (outlet_id = public.current_user_outlet_id());',
      t, t
    );

    -- Owner, Warehouse, dan Cashier dapat menambah/mengubah pada tabel inventory
    IF t <> 'accounting_journals' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_mutate_staff ON public.%I;', t, t);
      EXECUTE format(
        'CREATE POLICY %I_mutate_staff ON public.%I FOR ALL TO authenticated USING (outlet_id = public.current_user_outlet_id() AND public.current_user_role()::text IN (''owner'', ''warehouse'', ''cashier'')) WITH CHECK (outlet_id = public.current_user_outlet_id() AND public.current_user_role()::text IN (''owner'', ''warehouse'', ''cashier''));',
        t, t
      );
    ELSE
      -- Untuk accounting_journals: Owner, Warehouse, dan Cashier dapat INSERT; hanya Owner yang dapat UPDATE
      EXECUTE format('DROP POLICY IF EXISTS %I_insert_staff ON public.%I;', t, t);
      EXECUTE format(
        'CREATE POLICY %I_insert_staff ON public.%I FOR INSERT TO authenticated WITH CHECK (outlet_id = public.current_user_outlet_id() AND public.current_user_role()::text IN (''owner'', ''warehouse'', ''cashier''));',
        t, t
      );
    END IF;
  END LOOP;
END
$$;

-- ============================================================================
-- 13. PASANG TRIGGER AUDIT TRAIL (public.record_table_audit_log)
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ingredients',
    'product_recipes',
    'suppliers',
    'purchase_orders',
    'stock_opnames',
    'waste_logs',
    'stock_transfers',
    'accounting_journals'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();',
      t, t
    );
  END LOOP;
END
$$;

-- ============================================================================
-- 14. SEED DATA AWAL f&b1621 (INVENTORY, RESEP, SUPPLIER, PO, OPNAME, WASTE, JURNAL)
-- ============================================================================
UPDATE public.outlets
SET
  name = 'f&b1621',
  receipt_footer = 'Terima kasih telah berkunjung ke f&b1621!'
WHERE id = '00000000-0000-0000-0000-000000001621';

-- Update emoji pada produk yang sudah ada agar visual menu menarik
UPDATE public.products SET emoji = '🍚' WHERE name ILIKE '%Nasi Goreng%';
UPDATE public.products SET emoji = '🍜' WHERE name ILIKE '%Mie%' OR name ILIKE '%Bakmi%';
UPDATE public.products SET emoji = '🍗' WHERE name ILIKE '%Ayam%';
UPDATE public.products SET emoji = '🥩' WHERE name ILIKE '%Sapi%' OR name ILIKE '%Steak%';
UPDATE public.products SET emoji = '☕' WHERE name ILIKE '%Kopi%' OR name ILIKE '%Espresso%' OR name ILIKE '%Latte%';
UPDATE public.products SET emoji = '🧋' WHERE name ILIKE '%Teh%' OR name ILIKE '%Matcha%' OR name ILIKE '%Cokelat%';
UPDATE public.products SET emoji = '🍟' WHERE name ILIKE '%Kentang%' OR name ILIKE '%Snack%' OR name ILIKE '%Pisang%';

-- Seed 8 Bahan Baku Standar
INSERT INTO public.ingredients (id, outlet_id, name, category, unit, current_stock, min_stock, unit_cost, storage_stock)
VALUES
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000001621', 'Beras Premium', 'Beras & Biji', 'kg', 45, 20, 15000, '{"gudang": 30, "dapur": 15, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000001621', 'Telur Ayam', 'Protein & Telur', 'kg', 8, 10, 28000, '{"gudang": 5, "dapur": 3, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000001621', 'Daging Sapi Sirloin', 'Daging & Ayam', 'kg', 12, 5, 130000, '{"gudang": 8, "dapur": 4, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000001621', 'Minyak Goreng', 'Minyak & Lemak', 'liter', 22, 10, 17000, '{"gudang": 15, "dapur": 7, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000001621', 'Bawang Merah', 'Sayur & Bumbu', 'kg', 6, 8, 35000, '{"gudang": 4, "dapur": 2, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000001621', 'Ayam Fillet Segar', 'Daging & Ayam', 'kg', 18, 10, 55000, '{"gudang": 12, "dapur": 6, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005007', '00000000-0000-0000-0000-000000001621', 'Sayur Sawi Segar', 'Sayur & Bumbu', 'kg', 3, 5, 12000, '{"gudang": 1, "dapur": 2, "bar": 0}'::jsonb),
  ('00000000-0000-0000-0000-000000005008', '00000000-0000-0000-0000-000000001621', 'Biji Kopi Arabika & Susu', 'Bahan Bar & Minuman', 'kg', 25, 10, 65000, '{"gudang": 15, "dapur": 0, "bar": 10}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Resep (BOM) untuk produk yang ada di outlet 1621
INSERT INTO public.product_recipes (outlet_id, product_id, ingredient_id, qty_per_portion)
SELECT
  '00000000-0000-0000-0000-000000001621',
  p.id,
  '00000000-0000-0000-0000-000000005001',
  0.200
FROM public.products p
WHERE p.outlet_id = '00000000-0000-0000-0000-000000001621'
  AND p.name ILIKE '%Nasi%'
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

INSERT INTO public.product_recipes (outlet_id, product_id, ingredient_id, qty_per_portion)
SELECT
  '00000000-0000-0000-0000-000000001621',
  p.id,
  '00000000-0000-0000-0000-000000005002',
  0.100
FROM public.products p
WHERE p.outlet_id = '00000000-0000-0000-0000-000000001621'
  AND (p.name ILIKE '%Nasi%' OR p.name ILIKE '%Mie%')
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

INSERT INTO public.product_recipes (outlet_id, product_id, ingredient_id, qty_per_portion)
SELECT
  '00000000-0000-0000-0000-000000001621',
  p.id,
  '00000000-0000-0000-0000-000000005006',
  0.220
FROM public.products p
WHERE p.outlet_id = '00000000-0000-0000-0000-000000001621'
  AND p.name ILIKE '%Ayam%'
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

INSERT INTO public.product_recipes (outlet_id, product_id, ingredient_id, qty_per_portion)
SELECT
  '00000000-0000-0000-0000-000000001621',
  p.id,
  '00000000-0000-0000-0000-000000005008',
  0.080
FROM public.products p
WHERE p.outlet_id = '00000000-0000-0000-0000-000000001621'
  AND (p.name ILIKE '%Kopi%' OR p.name ILIKE '%Latte%' OR p.name ILIKE '%Matcha%')
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

-- Hitung ulang cogs_estimate produk berdasarkan resep
UPDATE public.products p
SET cogs_estimate = COALESCE(
  (
    SELECT round(sum(r.qty_per_portion * i.unit_cost))::integer
    FROM public.product_recipes r
    JOIN public.ingredients i ON i.id = r.ingredient_id
    WHERE r.product_id = p.id
  ),
  round(p.price * 0.32)::integer
)
WHERE p.outlet_id = '00000000-0000-0000-0000-000000001621';

-- Seed 5 Supplier
INSERT INTO public.suppliers (id, outlet_id, name, category, contact, address, payment_term, rating, payable_balance, is_active)
VALUES
  ('00000000-0000-0000-0000-000000006001', '00000000-0000-0000-0000-000000001621', 'PT Beras Sejahtera', 'Beras & Biji', '0812-1111-2222', 'Jl. Pasar Induk No. 12, Jakarta', '30 Hari', 5, 4500000, true),
  ('00000000-0000-0000-0000-000000006002', '00000000-0000-0000-0000-000000001621', 'CV Daging Prima', 'Daging & Ayam', '0813-3333-4444', 'Ruko Blok C5, Tangerang', '14 Hari', 4, 8200000, true),
  ('00000000-0000-0000-0000-000000006003', '00000000-0000-0000-0000-000000001621', 'UD Sayur Segar', 'Sayur & Bumbu', '0815-5555-6666', 'Pasar Kramat Jati, Jakarta Timur', 'COD', 5, 0, true),
  ('00000000-0000-0000-0000-000000006004', '00000000-0000-0000-0000-000000001621', 'Toko Sembako Jaya', 'Sembako & Bumbu', '0817-7777-8888', 'Jl. Raya Bogor KM 25', '7 Hari', 4, 1200000, true),
  ('00000000-0000-0000-0000-000000006005', '00000000-0000-0000-0000-000000001621', 'PT Kopi Nusantara', 'Bahan Bar & Minuman', '0819-9999-0000', 'Kawasan Kemang, Jakarta Selatan', '30 Hari', 5, 0, true)
ON CONFLICT (id) DO NOTHING;

-- Seed 4 Purchase Orders
INSERT INTO public.purchase_orders (id, outlet_id, po_no, supplier_id, supplier_name_snapshot, order_date, status, items_summary, items_json, total_amount, paid_amount, received_at)
VALUES
  (
    '00000000-0000-0000-0000-000000007001',
    '00000000-0000-0000-0000-000000001621',
    'PO-1621-101',
    '00000000-0000-0000-0000-000000006001',
    'PT Beras Sejahtera',
    CURRENT_DATE - INTERVAL '5 days',
    'diterima',
    'Beras Premium 300 kg',
    '[{"ingredient_id":"00000000-0000-0000-0000-000000005001","ingredient_name":"Beras Premium","qty":300,"unit":"kg","unit_cost":15000,"subtotal":4500000}]'::jsonb,
    4500000,
    0,
    now() - INTERVAL '4 days'
  ),
  (
    '00000000-0000-0000-0000-000000007002',
    '00000000-0000-0000-0000-000000001621',
    'PO-1621-102',
    '00000000-0000-0000-0000-000000006002',
    'CV Daging Prima',
    CURRENT_DATE - INTERVAL '2 days',
    'dikirim',
    'Daging Sapi Sirloin 40 kg, Ayam Fillet Segar 54.5 kg',
    '[{"ingredient_id":"00000000-0000-0000-0000-000000005003","ingredient_name":"Daging Sapi Sirloin","qty":40,"unit":"kg","unit_cost":130000,"subtotal":5200000},{"ingredient_id":"00000000-0000-0000-0000-000000005006","ingredient_name":"Ayam Fillet Segar","qty":54.545,"unit":"kg","unit_cost":55000,"subtotal":3000000}]'::jsonb,
    8200000,
    0,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000007003',
    '00000000-0000-0000-0000-000000001621',
    'PO-1621-103',
    '00000000-0000-0000-0000-000000006003',
    'UD Sayur Segar',
    CURRENT_DATE - INTERVAL '1 day',
    'lunas',
    'Sayur Sawi Segar 20 kg, Bawang Merah 15 kg',
    '[{"ingredient_id":"00000000-0000-0000-0000-000000005007","ingredient_name":"Sayur Sawi Segar","qty":20,"unit":"kg","unit_cost":12000,"subtotal":240000},{"ingredient_id":"00000000-0000-0000-0000-000000005005","ingredient_name":"Bawang Merah","qty":15,"unit":"kg","unit_cost":35000,"subtotal":525000}]'::jsonb,
    765000,
    765000,
    now() - INTERVAL '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000007004',
    '00000000-0000-0000-0000-000000001621',
    'PO-1621-104',
    '00000000-0000-0000-0000-000000006004',
    'Toko Sembako Jaya',
    CURRENT_DATE,
    'pending',
    'Minyak Goreng 40 liter, Telur Ayam 18.5 kg',
    '[{"ingredient_id":"00000000-0000-0000-0000-000000005004","ingredient_name":"Minyak Goreng","qty":40,"unit":"liter","unit_cost":17000,"subtotal":680000},{"ingredient_id":"00000000-0000-0000-0000-000000005002","ingredient_name":"Telur Ayam","qty":18.571,"unit":"kg","unit_cost":28000,"subtotal":520000}]'::jsonb,
    1200000,
    0,
    NULL
  )
ON CONFLICT (po_no) DO NOTHING;

-- Seed Riwayat Waste
INSERT INTO public.waste_logs (id, outlet_id, waste_date, ingredient_id, ingredient_name_snapshot, qty, unit, reason, cost_amount, recorded_by_name, notes)
VALUES
  ('00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000001621', CURRENT_DATE - INTERVAL '1 day', '00000000-0000-0000-0000-000000005007', 'Sayur Sawi Segar', 0.500, 'kg', 'Busuk', 6000, 'Andi Pratama', 'Layu saat sortir pagi'),
  ('00000000-0000-0000-0000-000000008002', '00000000-0000-0000-0000-000000001621', CURRENT_DATE - INTERVAL '1 day', '00000000-0000-0000-0000-000000005002', 'Telur Ayam', 0.200, 'kg', 'Rusak Produksi', 5600, 'Andi Pratama', 'Retak di rak penyimpanan'),
  ('00000000-0000-0000-0000-000000008003', '00000000-0000-0000-0000-000000001621', CURRENT_DATE - INTERVAL '2 days', '00000000-0000-0000-0000-000000005003', 'Daging Sapi Sirloin', 0.300, 'kg', 'Expired', 39000, 'Siti Aminah', 'Melewati batas simpan chiller'),
  ('00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000001621', CURRENT_DATE - INTERVAL '2 days', '00000000-0000-0000-0000-000000005004', 'Minyak Goreng', 1.000, 'liter', 'Tumpah', 17000, 'Siti Aminah', 'Tumpah saat pengisian fryer')
ON CONFLICT (id) DO NOTHING;

-- Seed Transfer Stok
INSERT INTO public.stock_transfers (id, outlet_id, transfer_no, transfer_date, from_location, to_location, ingredient_id, ingredient_name_snapshot, qty, unit, total_value, status, sender_name, receiver_name, notes)
VALUES
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000001621', 'TRF-001', CURRENT_DATE, 'Gudang Utama', 'Dapur Utama', '00000000-0000-0000-0000-000000005001', 'Beras Premium', 10.000, 'kg', 150000, 'in_transit', 'Andi Pratama', NULL, 'Restock beras dapur shift siang'),
  ('00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000001621', 'TRF-002', CURRENT_DATE, 'Gudang Utama', 'Dapur Utama', '00000000-0000-0000-0000-000000005004', 'Minyak Goreng', 5.000, 'liter', 85000, 'pending', 'Andi Pratama', NULL, 'Emergency restock penggorengan'),
  ('00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000001621', 'TRF-003', CURRENT_DATE - INTERVAL '1 day', 'Gudang Utama', 'Bar Minuman', '00000000-0000-0000-0000-000000005008', 'Biji Kopi Arabika & Susu', 8.000, 'kg', 520000, 'received', 'Andi Pratama', 'Siti Aminah', 'Stok kopi & susu bar mingguan')
ON CONFLICT (transfer_no) DO NOTHING;

-- Seed Jurnal Umum Awal (Agar Laporan Keuangan 5 Tab langsung kaya data)
INSERT INTO public.accounting_journals (outlet_id, journal_no, entry_date, description, debit_account, credit_account, amount, source_type)
VALUES
  ('00000000-0000-0000-0000-000000001621', 'JV-001', CURRENT_DATE - INTERVAL '7 days', 'Setoran Modal Awal & Kas Operasional f&b1621', 'Kas & Bank', 'Modal Pemilik', 25000000, 'owner_capital'),
  ('00000000-0000-0000-0000-000000001621', 'JV-002', CURRENT_DATE - INTERVAL '6 days', 'Investasi Peralatan Dapur & Mesin Espresso', 'Peralatan Dapur', 'Kas & Bank', 35000000, 'asset_purchase'),
  ('00000000-0000-0000-0000-000000001621', 'JV-003', CURRENT_DATE - INTERVAL '6 days', 'Investasi Meja & Kursi Outlet (100 Meja)', 'Meja & Kursi', 'Kas & Bank', 12000000, 'asset_purchase'),
  ('00000000-0000-0000-0000-000000001621', 'JV-004', CURRENT_DATE - INTERVAL '5 days', 'Penerimaan PO-1621-101 — PT Beras Sejahtera', 'Persediaan Bahan Baku', 'Hutang Usaha', 4500000, 'po_received'),
  ('00000000-0000-0000-0000-000000001621', 'JV-005', CURRENT_DATE - INTERVAL '3 days', 'Penjualan Dine-in & QRIS Meja (Rekap Mingguan)', 'Kas & Bank', 'Pendapatan Penjualan', 48500000, 'order_paid'),
  ('00000000-0000-0000-0000-000000001621', 'JV-006', CURRENT_DATE - INTERVAL '3 days', 'HPP Bahan Baku Terpakai (Rekap Mingguan)', 'HPP Bahan Baku', 'Persediaan Bahan Baku', 15520000, 'order_cogs'),
  ('00000000-0000-0000-0000-000000001621', 'JV-007', CURRENT_DATE - INTERVAL '2 days', 'Pembayaran Gaji Staf Operasional', 'Beban Gaji Karyawan', 'Kas & Bank', 9000000, 'expense_salary'),
  ('00000000-0000-0000-0000-000000001621', 'JV-008', CURRENT_DATE - INTERVAL '2 days', 'Pembayaran Sewa Outlet Bulanan', 'Beban Sewa Tempat', 'Kas & Bank', 3000000, 'expense_rent'),
  ('00000000-0000-0000-0000-000000001621', 'JV-009', CURRENT_DATE - INTERVAL '1 day', 'Pembayaran Listrik, Air & Internet', 'Beban Listrik & Air', 'Kas & Bank', 1250000, 'expense_utility'),
  ('00000000-0000-0000-0000-000000001621', 'JV-010', CURRENT_DATE - INTERVAL '1 day', 'Pencatatan Waste Bahan Baku (Sayur, Telur, Daging, Minyak)', 'Beban Waste & Spoilage', 'Persediaan Bahan Baku', 67600, 'waste')
ON CONFLICT (journal_no) DO NOTHING;

NOTIFY pgrst, 'reload schema';

