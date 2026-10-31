import type { TagColor } from "@/lib/validation/enums";
import { cn } from "@/lib/utils";

/** Full class strings (Tailwind only emits classes it can see); text is 800/200 on 50/950 for AA contrast. */
export const TAG_CHIP_CLASS: Record<TagColor, string> = {
  slate: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700",
  red: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  orange: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900",
  amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  green: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900",
  teal: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-900",
  blue: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-900",
  purple: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900",
  pink: "bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-900",
};

type ChipTag = { key: string; value: string | null; color: string };

/** Read-only chip: the label is always text (`key` or `key:value`), color is decoration; removal lives in the picker. */
export function TagChip({ tag, className }: { tag: ChipTag; className?: string }) {
  const label = tag.value === null ? tag.key : `${tag.key}:${tag.value}`;
  const palette = TAG_CHIP_CLASS[tag.color as TagColor] ?? TAG_CHIP_CLASS.slate;
  return (
    <span
      title={label}
      className={cn(
        "inline-block max-w-40 truncate rounded-full border px-2 py-0.5 align-middle text-xs font-medium",
        palette,
        "print:border-black print:bg-white print:text-black",
        className,
      )}
    >
      {label}
    </span>
  );
}
