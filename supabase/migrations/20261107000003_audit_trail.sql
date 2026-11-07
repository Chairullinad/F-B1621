-- ============================================================================
-- Migration: 20261107000003_audit_trail.sql
-- Deskripsi: Audit Trail (audit_logs) Append-Only, Rantai Hash SHA-256
--            (prev_hash, hash), Verifikasi Rantai, dan Trigger Otomatis
--            pada seluruh tabel bisnis penting.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER BLOKIR UPDATE & DELETE PADA audit_logs (TERMASUK OWNER & SUPERUSER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Pelanggaran keamanan: Tabel audit_logs bersifat append-only. Operasi % dilarang untuk semua pengguna termasuk Owner.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_prevent_mutation ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- ----------------------------------------------------------------------------
-- 2. TRIGGER RANTAI HASH KRIPTOGRAFIS (prev_hash & hash) PADA BEFORE INSERT
-- Menggunakan advisory lock transaksi agar urutan rantai hash selalu konsisten
-- walaupun banyak kasir menekan tombol secara bersamaan.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_audit_log_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_hash text;
  v_payload text;
BEGIN
  -- Kunci eksklusif tingkat transaksi untuk serialisasi rantai hash audit_logs
  PERFORM pg_advisory_xact_lock(hashtext('pos_1621_audit_logs_hash_chain'));

  SELECT a.hash
    INTO v_last_hash
  FROM public.audit_logs a
  ORDER BY a.id DESC
  LIMIT 1;

  NEW.prev_hash := COALESCE(v_last_hash, 'GENESIS');
  NEW.created_at := COALESCE(NEW.created_at, clock_timestamp());

  v_payload := concat_ws(
    '|',
    NEW.prev_hash,
    to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    COALESCE(NEW.outlet_id::text, ''),
    COALESCE(NEW.user_id::text, ''),
    COALESCE(NEW.role, ''),
    COALESCE(NEW.device, ''),
    COALESCE(NEW.ip, ''),
    NEW.action,
    NEW.entity,
    NEW.entity_id,
    COALESCE(NEW.before::text, 'null'),
    COALESCE(NEW.after::text, 'null'),
    COALESCE(NEW.reason, '')
  );

  NEW.hash := encode(extensions.digest(v_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_compute_hash ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_compute_hash
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.compute_audit_log_hash_chain();

-- ----------------------------------------------------------------------------
-- 3. FUNGSI VERIFIKASI RANTAI HASH AUDIT (public.verify_audit_chain)
-- Memeriksa apakah ada baris yang dihapus atau diubah secara manual di database.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS TABLE (
  is_valid boolean,
  checked_rows bigint,
  broken_at_id bigint,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec record;
  v_expected_prev text := 'GENESIS';
  v_recomputed_hash text;
  v_payload text;
  v_count bigint := 0;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.audit_logs
    ORDER BY id ASC
  LOOP
    v_count := v_count + 1;

    IF rec.prev_hash <> v_expected_prev THEN
      RETURN QUERY SELECT
        false,
        v_count,
        rec.id,
        format('prev_hash tidak cocok pada id=%s (diharapkan %s, ditemukan %s)', rec.id, v_expected_prev, rec.prev_hash);
      RETURN;
    END IF;

    v_payload := concat_ws(
      '|',
      rec.prev_hash,
      to_char(rec.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      COALESCE(rec.outlet_id::text, ''),
      COALESCE(rec.user_id::text, ''),
      COALESCE(rec.role, ''),
      COALESCE(rec.device, ''),
      COALESCE(rec.ip, ''),
      rec.action,
      rec.entity,
      rec.entity_id,
      COALESCE(rec.before::text, 'null'),
      COALESCE(rec.after::text, 'null'),
      COALESCE(rec.reason, '')
    );

    v_recomputed_hash := encode(extensions.digest(v_payload, 'sha256'), 'hex');

    IF rec.hash <> v_recomputed_hash THEN
      RETURN QUERY SELECT
        false,
        v_count,
        rec.id,
        format('hash tidak cocok pada id=%s (data telah dimodifikasi)', rec.id);
      RETURN;
    END IF;

    v_expected_prev := rec.hash;
  END LOOP;

  RETURN QUERY SELECT true, v_count, NULL::bigint, 'Rantai hash audit_logs utuh dan valid.'::text;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. HELPER KONTEKS AUDIT UNTUK SERVER ACTION / TRANSAKSI
-- Memungkinkan server mengirim IP, User-Agent/device, role, atau alasan bisnis
-- ke dalam sesi transaksi database.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_audit_context(
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.audit_user_id', p_user_id::text, true);
  END IF;
  IF p_role IS NOT NULL THEN
    PERFORM set_config('app.audit_role', p_role, true);
  END IF;
  IF p_device IS NOT NULL THEN
    PERFORM set_config('app.audit_device', p_device, true);
  END IF;
  IF p_ip IS NOT NULL THEN
    PERFORM set_config('app.audit_ip', p_ip, true);
  END IF;
  IF p_reason IS NOT NULL THEN
    PERFORM set_config('app.audit_reason', p_reason, true);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. TRIGGER PENCATAT OTOMATIS UNTUK SEMUA TABEL BISNIS PENTING
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_table_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_before jsonb := NULL;
  v_after jsonb := NULL;
  v_entity_id text;
  v_outlet_id uuid := NULL;
  v_user_id uuid := NULL;
  v_role text := NULL;
  v_device text := NULL;
  v_ip text := NULL;
  v_reason text := NULL;
  v_action text;
  v_ctx_user text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    -- Abaikan jika tidak ada perubahan nilai bisnis selain updated_at
    IF (v_before - 'updated_at') = (v_after - 'updated_at') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
  END IF;

  -- Ambil entity_id
  v_entity_id := COALESCE(
    v_after ->> 'id',
    v_before ->> 'id',
    'unknown'
  );

  -- Resolusi outlet_id berdasarkan tabel
  IF TG_TABLE_NAME = 'outlets' THEN
    v_outlet_id := COALESCE((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid);
  ELSIF COALESCE(v_after ->> 'outlet_id', v_before ->> 'outlet_id') IS NOT NULL THEN
    v_outlet_id := COALESCE((v_after ->> 'outlet_id')::uuid, (v_before ->> 'outlet_id')::uuid);
  ELSIF TG_TABLE_NAME IN ('order_items', 'payments', 'refunds') THEN
    SELECT o.outlet_id
      INTO v_outlet_id
    FROM public.orders o
    WHERE o.id = COALESCE((v_after ->> 'order_id')::uuid, (v_before ->> 'order_id')::uuid);
  END IF;

  -- Resolusi user_id dari auth.uid() atau konteks aplikasi atau kolom pelaku
  v_ctx_user := nullif(current_setting('app.audit_user_id', true), '');
  v_user_id := COALESCE(
    auth.uid(),
    CASE WHEN v_ctx_user IS NOT NULL THEN v_ctx_user::uuid ELSE NULL END,
    (v_after ->> 'cancelled_by')::uuid,
    (v_after ->> 'paid_by')::uuid,
    (v_after ->> 'served_by')::uuid,
    (v_after ->> 'created_by')::uuid
  );

  -- Resolusi role dari tabel profiles atau konteks
  IF v_user_id IS NOT NULL THEN
    SELECT p.role::text
      INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
    LIMIT 1;
  END IF;
  v_role := COALESCE(
    v_role,
    nullif(current_setting('app.audit_role', true), ''),
    CASE
      WHEN TG_TABLE_NAME = 'orders' AND (v_after ->> 'source') = 'customer_qr' AND TG_OP = 'INSERT'
      THEN 'customer_qr'
      ELSE 'system'
    END
  );

  -- Resolusi perangkat, IP, dan alasan
  v_device := nullif(current_setting('app.audit_device', true), '');
  v_ip := COALESCE(
    nullif(current_setting('app.audit_ip', true), ''),
    inet_client_addr()::text
  );
  v_reason := COALESCE(
    nullif(current_setting('app.audit_reason', true), ''),
    v_after ->> 'cancel_reason',
    v_after ->> 'discount_reason',
    v_after ->> 'reason'
  );

  -- Tentukan nama action yang spesifik dan informatif
  v_action := TG_TABLE_NAME || '.' || lower(TG_OP);

  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN
      v_action := 'order.created';
    ELSIF TG_OP = 'UPDATE' THEN
      IF (v_before ->> 'status') IS DISTINCT FROM (v_after ->> 'status') THEN
        v_action := 'order.status_' || (v_after ->> 'status');
      ELSIF (v_before ->> 'discount') IS DISTINCT FROM (v_after ->> 'discount') THEN
        v_action := 'order.discount_updated';
      ELSIF (v_before ->> 'deleted_at') IS NULL AND (v_after ->> 'deleted_at') IS NOT NULL THEN
        v_action := 'order.soft_deleted';
      ELSE
        v_action := 'order.updated';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    IF TG_OP = 'INSERT' THEN
      v_action := 'order_item.added';
    ELSIF TG_OP = 'UPDATE' THEN
      v_action := 'order_item.revised';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'order_item.removed';
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'INSERT' THEN
    v_action := 'payment.recorded';
  ELSIF TG_TABLE_NAME = 'refunds' AND TG_OP = 'INSERT' THEN
    v_action := 'refund.recorded';
  ELSIF TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE' THEN
    IF (v_before ->> 'price') IS DISTINCT FROM (v_after ->> 'price') THEN
      v_action := 'product.price_changed';
    ELSIF (v_before ->> 'is_available') IS DISTINCT FROM (v_after ->> 'is_available') THEN
      v_action := 'product.availability_toggled';
    ELSIF (v_before ->> 'deleted_at') IS NULL AND (v_after ->> 'deleted_at') IS NOT NULL THEN
      v_action := 'product.soft_deleted';
    END IF;
  ELSIF TG_TABLE_NAME = 'tables' AND TG_OP = 'UPDATE' THEN
    IF (v_before ->> 'qr_token') IS DISTINCT FROM (v_after ->> 'qr_token') THEN
      v_action := 'table.qr_regenerated';
    END IF;
  ELSIF TG_TABLE_NAME = 'outlets' AND TG_OP = 'UPDATE' THEN
    v_action := 'outlet.settings_updated';
  ELSIF TG_TABLE_NAME = 'notification_settings' AND TG_OP = 'UPDATE' THEN
    v_action := 'notification.settings_updated';
  ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
    IF (v_before ->> 'role') IS DISTINCT FROM (v_after ->> 'role') THEN
      v_action := 'profile.role_changed';
    ELSIF (v_before ->> 'is_active') IS DISTINCT FROM (v_after ->> 'is_active') THEN
      v_action := 'profile.active_toggled';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    outlet_id,
    user_id,
    role,
    device,
    ip,
    action,
    entity,
    entity_id,
    before,
    after,
    reason,
    prev_hash,
    hash
  ) VALUES (
    v_outlet_id,
    v_user_id,
    v_role,
    v_device,
    v_ip,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_before,
    v_after,
    v_reason,
    '',
    ''
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Pasang trigger audit pada seluruh tabel bisnis penting
DROP TRIGGER IF EXISTS trg_audit_outlets ON public.outlets;
CREATE TRIGGER trg_audit_outlets
  AFTER INSERT OR UPDATE OR DELETE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_notification_settings ON public.notification_settings;
CREATE TRIGGER trg_audit_notification_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_tables ON public.tables;
CREATE TRIGGER trg_audit_tables
  AFTER INSERT OR UPDATE OR DELETE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_order_items ON public.order_items;
CREATE TRIGGER trg_audit_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

DROP TRIGGER IF EXISTS trg_audit_refunds ON public.refunds;
CREATE TRIGGER trg_audit_refunds
  AFTER INSERT OR UPDATE OR DELETE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();

-- ----------------------------------------------------------------------------
-- 6. FUNGSI RPC UNTUK MENCATAT EVENT NON-TABEL
-- (contoh: cetak ulang struk, login/logout/gagal login, pengiriman email Owner)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_outlet_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_inserted_id bigint;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT p.role::text
      INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id
    LIMIT 1;
  END IF;

  INSERT INTO public.audit_logs (
    outlet_id,
    user_id,
    role,
    device,
    ip,
    action,
    entity,
    entity_id,
    before,
    after,
    reason,
    prev_hash,
    hash
  ) VALUES (
    p_outlet_id,
    v_user_id,
    COALESCE(v_role, nullif(current_setting('app.audit_role', true), ''), 'system'),
    COALESCE(p_device, nullif(current_setting('app.audit_device', true), '')),
    COALESCE(p_ip, nullif(current_setting('app.audit_ip', true), ''), inet_client_addr()::text),
    p_action,
    p_entity,
    p_entity_id,
    p_before,
    p_after,
    p_reason,
    '',
    ''
  )
  RETURNING id INTO v_inserted_id;

  RETURN v_inserted_id;
END;
$$;
