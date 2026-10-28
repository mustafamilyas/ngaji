/**
 * Touch sizes for the shared primitives (`Button`, `Input`, `Textarea`, `Select`) live in those components: 44px tall
 * with 16px text below `xl` (so a 1024px landscape tablet keeps 44px; 16px keeps iOS Safari from zooming on focus),
 * compact again from `xl`. This file only has the same rule for NATIVE form elements (`<input>`, `<select>`) that do not
 * go through a primitive.
 */
export const touchField =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 xl:h-9 xl:text-sm";
