"use client";

import { Button } from "@/components/ui/button";

export function PrintTriggerButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </Button>
  );
}
