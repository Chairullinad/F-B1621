import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Masuk Staf POS 1621 F&amp;B</CardTitle>
          <CardDescription>
            Masuk menggunakan akun email dan kata sandi sesuai role (Owner,
            Kasir, Dapur, atau Pelayan).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email Staf
            </label>
            <Input
              id="email"
              type="email"
              placeholder="kasir@1621fnb.id"
              disabled
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Kata Sandi
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              disabled
            />
          </div>
          <Button className="w-full" disabled>
            Masuk (Akan Diaktifkan di Tahap 3)
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Kembali ke Beranda</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
