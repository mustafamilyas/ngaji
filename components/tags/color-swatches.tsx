"use client";

import { CheckIcon } from "lucide-react";
import { TAG_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TagColor } from "@/lib/validation/enums";

/** Names for screen readers and tooltips; the palette keys themselves are English. */
export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  slate: "Abu-abu",
  red: "Merah",
  orange: "Jingga",
  amber: "Kuning",
  green: "Hijau",
  teal: "Hijau tosca",
  blue: "Biru",
  indigo: "Nila",
  purple: "Ungu",
  pink: "Merah muda",
};

/** Full class strings (Tailwind only emits classes it can see). */
const SWATCH_CLASS: Record<TagColor, string> = {
  slate: "bg-slate-500",
  red: "bg-red-600",
  orange: "bg-orange-600",
  amber: "bg-amber-600",
  green: "bg-green-600",
  teal: "bg-teal-600",
  blue: "bg-blue-600",
  indigo: "bg-indigo-600",
  purple: "bg-purple-600",
  pink: "bg-pink-600",
};

/**
 * The tag palette as a radio group of round swatches. Each swatch is a 44px target below `xl`; the chosen one
 * carries a check mark and a ring, so the selection never depends on color alone.
 */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (color: TagColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Warna tag" className="flex flex-wrap gap-1">
      {TAG_COLORS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={TAG_COLOR_LABELS[color]}
            title={TAG_COLOR_LABELS[color]}
            onClick={() => onChange(color)}
            className="inline-flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 xl:size-8"
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-white xl:size-6",
                SWATCH_CLASS[color],
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
              )}
            >
              {selected && <CheckIcon className="size-4" strokeWidth={3} aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
