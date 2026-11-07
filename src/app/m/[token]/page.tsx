import { CustomerOrderExperience } from "@/components/customer/customer-order-experience";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCustomerTableMenuByToken } from "@/server/customer-order";

export default async function CustomerTableOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tableData = await getCustomerTableMenuByToken(token);

  if (!tableData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-900">
              QR Meja Tidak Berlaku
            </CardTitle>
            <CardDescription>
              Kode QR yang Anda pindai sudah tidak aktif atau telah diperbarui
              oleh pihak restoran. Silakan pindai kode QR terbaru yang tertera
              di meja Anda atau hubungi pelayan.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return <CustomerOrderExperience data={tableData} />;
}
