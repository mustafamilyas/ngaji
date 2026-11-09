"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ className }: { className?: string }) {
  return (
    <Button type="button" className={className} onClick={() => window.print()}>
      <Printer />
      Cetak
    </Button>
  );
}
