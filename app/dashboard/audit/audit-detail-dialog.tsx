"use client";

import { FileJson } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Snapshot of one audit entry (already redacted when written, DESIGN.md §4.4). */
export function AuditDetailDialog({ title, subtitle, detail }: { title: string; subtitle: string; detail: string }) {
  return (
    <Dialog>
      <DialogTrigger aria-label={`Detail ${title}`} title="Detail" className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <FileJson />
      </DialogTrigger>
      <DialogContent className="w-[min(40rem,calc(100vw-2rem))]">
        <DialogTitle className="font-mono text-base">{title}</DialogTitle>
        <DialogDescription>{subtitle}</DialogDescription>
        <pre className="mt-4 max-h-[60dvh] overflow-auto rounded-lg bg-muted p-3 text-xs">{detail}</pre>
      </DialogContent>
    </Dialog>
  );
}
