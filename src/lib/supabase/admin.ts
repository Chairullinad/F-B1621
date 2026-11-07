import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client menggunakan SUPABASE_SERVICE_ROLE_KEY.
 * ATURAN KEAMANAN (AGENTS.md):
 * - Hanya boleh diimpor di sisi server (dilindungi oleh paket 'server-only').
 * - Jangan pernah mengekspos service_role key ke kode klien atau browser.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diatur di environment variable server."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

