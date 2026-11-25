import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canOwnerAccessWithoutOutlet,
  canRoleAccessPathname,
  getDefaultRouteForUser,
  isStaffProtectedPathname,
  sanitizeCustomPermissions,
} from "@/lib/auth";
import type { UserRole } from "@/lib/types/database";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // Halaman pelanggan (/m/[token]) tidak memerlukan autentikasi staf
  if (pathname.startsWith("/m/")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = isStaffProtectedPathname(pathname);

  if (!user) {
    if (isProtected) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // Ambil role dan status aktif staf dari tabel profiles (menggunakan RLS profiles_select_same_outlet)
  let profile: {
    role: string;
    is_active: boolean;
    deleted_at: string | null;
    custom_permissions?: unknown;
  } | null = null;

  const { data: profileWithPerms, error: profilePermsErr } = await supabase
    .from("profiles")
    .select("role, is_active, deleted_at, custom_permissions")
    .eq("id", user.id)
    .maybeSingle();

  if (profilePermsErr && profilePermsErr.message.includes("custom_permissions")) {
    const { data: fallbackProfile } = await supabase
      .from("profiles")
      .select("role, is_active, deleted_at")
      .eq("id", user.id)
      .maybeSingle();
    profile = fallbackProfile;
  } else {
    profile = profileWithPerms;
  }

  if (!profile || !profile.is_active || profile.deleted_at !== null) {
    if (isProtected) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const role = profile.role as UserRole;
  const customPermissions = sanitizeCustomPermissions(profile.custom_permissions);

  // Jika sudah login lalu membuka /login, langsung arahkan ke rute default usernya
  if (pathname === "/login") {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = getDefaultRouteForUser(role, customPermissions);
    targetUrl.search = "";
    return NextResponse.redirect(targetUrl);
  }

  // Cek apakah user (role + custom permissions) boleh mengakses rute ini
  if (isProtected && !canRoleAccessPathname(role, pathname, customPermissions)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getDefaultRouteForUser(role, customPermissions);
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Owner yang belum masuk ke salah satu kios hanya boleh membuka Dashboard Holding,
  // Laporan Keuangan, dan Setting Kios.
  if (
    isProtected &&
    role === "owner" &&
    !canOwnerAccessWithoutOutlet(pathname) &&
    !request.cookies.get("fnb1621_active_outlet")?.value
  ) {
    const holdingUrl = request.nextUrl.clone();
    holdingUrl.pathname = "/dashboard";
    holdingUrl.search = "";
    holdingUrl.searchParams.set("pilih_kios", "1");
    return NextResponse.redirect(holdingUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

