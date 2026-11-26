/**
 * Helper query murni (tanpa dependensi server-only) agar dapat diuji unit test
 * dengan `node --test` serta dipakai bersama di layer server.
 */

export interface PaginatedQueryResult<T> {
  data: T[] | null;
  error: { message?: string | null; code?: string | null } | null;
}

export interface DatabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/**
 * Mengambil seluruh baris dari query Supabase/PostgREST melampaui batas
 * default `max_rows = 1000` dengan paginasi `.range(from, to)`.
 */
export async function fetchAllPaginated<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PaginatedQueryResult<T>>,
  pageSize = 1000,
  maxPages = 50
): Promise<T[]> {
  if (pageSize <= 0 || maxPages <= 0) {
    return [];
  }

  const allRows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw new Error(error.message ?? "Gagal mengambil data terpaginasi.");
    }

    const batch = data ?? [];
    allRows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return allRows;
}

/**
 * Mendeteksi error Postgres unique violation (kode 23505) untuk kolom `order_no`
 * sehingga generator `order_no` acak dapat langsung mencoba ulang secara aman.
 */
export function isUniqueOrderNoViolation(
  error: DatabaseErrorLike | null | undefined
): boolean {
  if (!error) return false;
  const combined = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (error.code === "23505") {
    if (combined.includes("idempotency")) {
      return false;
    }
    return true;
  }

  return combined.includes("duplicate key") && combined.includes("order_no");
}
