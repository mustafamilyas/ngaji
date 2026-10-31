"use client";

import { cloneElement, type ReactElement } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery, XL_QUERY } from "@/lib/use-media-query";

/**
 * Where tag choosers open: a popover anchored to the trigger from `xl`, a bottom sheet below it (touch sizes).
 * `trigger` is a single button element; below `xl` it only needs to open the sheet, so it is given the click.
 */
export function TagOverlay({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement<{ onClick?: () => void }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const wide = useMediaQuery(XL_QUERY);

  if (wide) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger render={trigger} />
        <PopoverContent className="w-80 p-0">{children}</PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {cloneElement(trigger, { onClick: () => onOpenChange(true) })}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="gap-0 rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
