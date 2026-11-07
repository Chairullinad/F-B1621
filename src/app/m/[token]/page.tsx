import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerTableOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Pemesanan Mandiri Meja</CardTitle>
          <CardDescription>
            Token QR Meja: <code className="font-mono text-xs">{token}</code>.
            Nomor meja ditentukan otomatis oleh server dari token QR ini.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

