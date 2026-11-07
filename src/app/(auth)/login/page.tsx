import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDefaultRouteForRole } from "@/lib/auth";
import { getCurrentStaffSession } from "@/server/auth";

export default async function LoginPage() {
  const staff = await getCurrentStaffSession();
  if (staff) {
    redirect(getDefaultRouteForRole(staff.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Masuk Staf POS 1621 F&amp;B</CardTitle>
          <CardDescription>
            Masuk menggunakan akun email dan kata sandi sesuai role (Owner,
            Kasir, Dapur, atau Pelayan). Anda akan diarahkan otomatis ke layar
            kerja Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Kembali ke Beranda</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
