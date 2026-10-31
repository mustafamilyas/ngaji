"use client";

import { cloneElement, type ReactElement } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { useMediaQuery, XL_QUERY } from "@/lib/use-media-query";

/** Chooser list height below `xl`: 70% of the viewport minus the keyboard, never under 10rem; `xl` is a popover. */
export const TAG_LIST_MAX_H = "max-h-[max(10rem,calc(70dvh-var(--kb-inset,0px)))] xl:max-h-80";

/**
 * Where tag choosers open: a popover anchored to the trigger from `xl`, a bottom sheet below it (touch sizes).
 * `trigger` is a single button element; below `xl` it only needs to open the sheet, so it is given the click.
 */
/**
 * Focus the first field (the search box) when opened with a mouse or keyboard, but not by touch: on a phone the
 * on-screen keyboard would open over the list before anything has been seen. Same rule as the group filter.
 */
const focusUnlessTouch = (openType: string) => openType !== "touch";

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
  // The sheet lifts above the on-screen keyboard; choosers size their list from `--kb-inset` (see `TAG_LIST_MAX_H`).
  const inset = useKeyboardInset(open && !wide);

  if (wide) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger render={trigger} />
        <PopoverContent className="w-80 p-0" initialFocus={focusUnlessTouch}>
          {children}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {cloneElement(trigger, { onClick: () => onOpenChange(true) })}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-xl"
          initialFocus={focusUnlessTouch}
          style={{ bottom: inset, "--kb-inset": `${inset}px` } as React.CSSProperties}
        >
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
