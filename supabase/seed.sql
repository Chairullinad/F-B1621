-- ============================================================================
-- Seed Data: supabase/seed.sql
-- Deskripsi:
-- - 1 Outlet ("Kafe Nusantara 1621") dengan pajak & service charge mati default
-- - 1 Pengaturan Notifikasi Owner
-- - 3 Kategori
-- - 10 Produk (harga integer Rupiah)
-- - 100 Meja (Meja 1 s/d Meja 100) dengan qr_token acak & unik (48 hex chars)
-- ============================================================================

BEGIN;

-- 1. Outlet Utama
INSERT INTO public.outlets (
  id,
  name,
  address,
  receipt_footer,
  order_expiry_minutes,
  tax_enabled,
  tax_percent,
  service_enabled,
  service_percent,
  price_includes_tax
) VALUES (
  '00000000-0000-0000-0000-000000001621',
  'Kafe Nusantara 1621',
  'Jl. Merdeka No. 1621, Jakarta',
  'Terima kasih telah berkunjung ke Kafe Nusantara 1621!',
  15,
  false,
  NULL,
  false,
  NULL,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  receipt_footer = EXCLUDED.receipt_footer;

-- 2. Pengaturan Notifikasi Email Owner
INSERT INTO public.notification_settings (
  id,
  outlet_id,
  owner_email,
  monthly_report_enabled,
  instant_events
) VALUES (
  '00000000-0000-0000-0000-000000001622',
  '00000000-0000-0000-0000-000000001621',
  NULL,
  false,
  '{"refund": false, "paid_cancellation": false, "discount": false, "price_or_setting_change": false}'::jsonb
)
ON CONFLICT (outlet_id) DO NOTHING;

-- 3. Tiga Kategori Menu
INSERT INTO public.categories (id, outlet_id, name, sort_order, is_active)
VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000001621', 'Makanan Utama', 1, true),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000001621', 'Minuman', 2, true),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000001621', 'Camilan & Dessert', 3, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 4. Sepuluh Produk (Harga dalam integer Rupiah)
INSERT INTO public.products (id, outlet_id, category_id, name, price, is_available, is_active)
VALUES
  -- Makanan Utama (4 produk)
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000001', 'Nasi Goreng Spesial 1621', 35000, true, true),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000001', 'Mie Goreng Jawa Ayam Kampung', 32000, true, true),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000001', 'Ayam Bakar Madu Lalapan', 42000, true, true),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000001', 'Soto Betawi Daging Sapi', 38000, true, true),

  -- Minuman (4 produk)
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000002', 'Es Kopi Susu Gula Aren', 22000, true, true),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000002', 'Iced Matcha Latte', 26000, true, true),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000002', 'Es Teh Kampul Jeruk Nipis', 12000, true, true),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000002', 'Jus Alpukat Cokelat', 24000, true, true),

  -- Camilan & Dessert (2 produk)
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000003', 'Pisang Goreng Keju Aren', 20000, true, true),
  ('00000000-0000-0000-0002-000000000010', '00000000-0000-0000-0000-000000001621', '00000000-0000-0000-0001-000000000003', 'Kentang Goreng Truffle', 25000, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  category_id = EXCLUDED.category_id,
  is_available = EXCLUDED.is_available,
  is_active = EXCLUDED.is_active;

-- 5. 100 Meja (Meja 1 s/d Meja 100) dengan qr_token acak & unik
INSERT INTO public.tables (outlet_id, table_no, name, qr_token, is_active)
SELECT
  '00000000-0000-0000-0000-000000001621'::uuid,
  gs.table_no,
  'Meja ' || gs.table_no,
  encode(extensions.gen_random_bytes(24), 'hex'),
  true
FROM generate_series(1, 100) AS gs(table_no)
ON CONFLICT (outlet_id, table_no) DO NOTHING;

COMMIT;
