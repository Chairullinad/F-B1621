import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SystemConnectionStatus {
  supabaseConfigured: boolean;
  supabaseReachable: boolean;
  schemaReady: boolean;
  supabaseUrlHost: string | null;
  counts: {
    categories: number;
    products: number;
    tables: number;
  } | null;
  message: string;
}

export async function getSystemConnectionStatus(): Promise<SystemConnectionStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !anonKey ||
    !serviceKey ||
    url.includes("YOUR_DEV_PROJECT_REF") ||
    anonKey.includes("YOUR_DEV_SUPABASE_ANON_KEY")
  ) {
    return {
      supabaseConfigured: false,
      supabaseReachable: false,
      schemaReady: false,
      supabaseUrlHost: null,
      counts: null,
      message:
        "Kredensial Supabase dev belum diatur di .env.local. Salin .env.example ke .env.local lalu isi URL dan key project dev.",
    };
  }

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    return {
      supabaseConfigured: false,
      supabaseReachable: false,
      schemaReady: false,
      supabaseUrlHost: null,
      counts: null,
      message: "Format NEXT_PUBLIC_SUPABASE_URL di .env.local tidak valid.",
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [catRes, prodRes, tableRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("tables")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
    ]);

    if (catRes.error || prodRes.error || tableRes.error) {
      const errMsg =
        catRes.error?.message ??
        prodRes.error?.message ??
        tableRes.error?.message ??
        "Tabel belum dibuat";
      return {
        supabaseConfigured: true,
        supabaseReachable: true,
        schemaReady: false,
        supabaseUrlHost: host,
        counts: null,
        message: `Terhubung ke Supabase dev (${host}), menunggu eksekusi migration (${errMsg}).`,
      };
    }

    const counts = {
      categories: catRes.count ?? 0,
      products: prodRes.count ?? 0,
      tables: tableRes.count ?? 0,
    };

    return {
      supabaseConfigured: true,
      supabaseReachable: true,
      schemaReady: true,
      supabaseUrlHost: host,
      counts,
      message: `Terhubung ke Supabase dev (${host}) — ${counts.categories} kategori, ${counts.products} produk, ${counts.tables} meja aktif.`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Gagal menghubungi server";
    return {
      supabaseConfigured: true,
      supabaseReachable: false,
      schemaReady: false,
      supabaseUrlHost: host,
      counts: null,
      message: `Konfigurasi Supabase dev (${host}) ditemukan, namun koneksi jaringan gagal: ${detail}`,
    };
  }
}
