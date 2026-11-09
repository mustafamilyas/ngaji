"use client";

import Link from "next/link";
import { FileUp, UserPlus } from "lucide-react";
import { RowActions } from "@/components/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The Anggota page's header actions: add a member, and a ⋮ menu for the rarer bulk import (no second wide button on a phone). */
export function MemberHeaderActions() {
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Link
        href="/dashboard/anggota/baru"
        className={cn(buttonVariants({ size: "lg" }), "h-11 flex-1 text-base sm:flex-none xl:h-9 xl:text-sm")}
      >
        <UserPlus />
        Tambah anggota
      </Link>
      <RowActions
        label="daftar anggota"
        className="border"
        actions={[{ label: "Impor CSV", href: "/dashboard/anggota/impor", icon: <FileUp /> }]}
      />
    </div>
  );
}
