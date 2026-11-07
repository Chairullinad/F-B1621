import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuditPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jejak Audit (Append-Only)</CardTitle>
        <CardDescription>
          Catatan permanen seluruh aktivitas penting dengan nilai sebelum,
          sesudah, dan rantai hash kriptografis.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
