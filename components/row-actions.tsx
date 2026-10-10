"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = { label: string; href: string; icon?: React.ReactNode; external?: boolean };

/**
 * Kebab menu at the end of a table row. Links only: destructive actions stay
 * in the detail page's danger zone, where their consequence is explained.
 */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Aksi untuk ${label}`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {actions.map((action) =>
          action.external ? (
            <DropdownMenuLinkItem
              key={action.href}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              closeOnClick
            >
              {action.icon}
              {action.label}
            </DropdownMenuLinkItem>
          ) : (
            <DropdownMenuLinkItem key={action.href} render={<Link href={action.href} />} closeOnClick>
              {action.icon}
              {action.label}
            </DropdownMenuLinkItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
