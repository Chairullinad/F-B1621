import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffRole } from "@/server/auth";

export default async function AntarPage() {
  const staff = await requireStaffRole(["owner", "waiter"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Antar (Pelayan) — {staff.fullName}</CardTitle>
        <CardDescription>
          Menampilkan order berstatus READY per meja dan tombol Sudah Diantar
          (SERVED).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
