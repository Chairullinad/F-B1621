-- ============================================================================
-- Migration: 0006_cashier_shift_closing.sql
-- Deskripsi: Dokumentasi & indeks pendukung laporan Tutupan Shift Kasir (Closing Shift)
-- Penyimpanan utama terintegrasi dengan audit_logs (entity = 'cashier_shifts', action = 'shift.closed')
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_cashier_shifts
  ON public.audit_logs (entity, action, created_at DESC)
  WHERE entity = 'cashier_shifts';

