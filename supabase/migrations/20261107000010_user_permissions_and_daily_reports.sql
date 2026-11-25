-- ============================================================================
-- Migrasi 0010: Hak Akses Per-User (Promosi Staf) & Pengaturan Report Harian Holding
-- ============================================================================

-- 1. Kolom custom_permissions per user pada tabel public.profiles
--    NULL = mengikuti izin standar dari Role user tersebut.
--    JSONB object = override izin per modul/fitur (true = izinkan, false = cabut).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_permissions jsonb DEFAULT NULL;

-- 2. Tabel pengaturan Holding Dashboard Utama (Notifikasi Owner & Report Harian ZIP)
CREATE TABLE IF NOT EXISTS public.holding_settings (
  id text PRIMARY KEY DEFAULT 'default',
  owner_email text NULL,
  daily_report_enabled boolean NOT NULL DEFAULT false,
  daily_report_time_wib text NOT NULL DEFAULT '23:55' CHECK (
    daily_report_time_wib ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  daily_report_outlet_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_report_sections jsonb NOT NULL DEFAULT '{
    "sales": true,
    "profit_loss": true,
    "cash_flow": true,
    "tax": true,
    "journals": true,
    "inventory": true,
    "audit": true
  }'::jsonb,
  last_daily_report_date text NULL,
  last_daily_report_sent_at timestamptz NULL,
  monthly_report_enabled boolean NOT NULL DEFAULT false,
  instant_events jsonb NOT NULL DEFAULT '{
    "refund": true,
    "paid_cancellation": true,
    "discount": true,
    "price_or_setting_change": true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed singleton row default
INSERT INTO public.holding_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- 3. RLS untuk public.holding_settings (khusus Owner aktif)
ALTER TABLE public.holding_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'holding_settings' AND policyname = 'holding_settings_owner_select'
  ) THEN
    CREATE POLICY holding_settings_owner_select ON public.holding_settings
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'
            AND profiles.is_active = true
            AND profiles.deleted_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'holding_settings' AND policyname = 'holding_settings_owner_insert'
  ) THEN
    CREATE POLICY holding_settings_owner_insert ON public.holding_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'
            AND profiles.is_active = true
            AND profiles.deleted_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'holding_settings' AND policyname = 'holding_settings_owner_update'
  ) THEN
    CREATE POLICY holding_settings_owner_update ON public.holding_settings
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'
            AND profiles.is_active = true
            AND profiles.deleted_at IS NULL
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'
            AND profiles.is_active = true
            AND profiles.deleted_at IS NULL
        )
      );
  END IF;
END $$;

-- 4. Trigger updated_at & audit trail untuk public.holding_settings
DROP TRIGGER IF EXISTS trg_holding_settings_updated_at ON public.holding_settings;
CREATE TRIGGER trg_holding_settings_updated_at
  BEFORE UPDATE ON public.holding_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_audit_holding_settings ON public.holding_settings;
CREATE TRIGGER trg_audit_holding_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.holding_settings
  FOR EACH ROW EXECUTE FUNCTION public.record_table_audit_log();
