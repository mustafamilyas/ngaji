/**
 * Touch-friendly sizes for forms that phones and tablets use: 44px tall up to
 * the `xl` breakpoint (so a 1024px landscape tablet keeps 44px), compact again on desktop. 16px text on small screens
 * keeps iOS Safari from zooming the page when a field gets focus.
 */
export const touchField =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 xl:h-9 xl:text-sm";

export const touchButton = "h-11 px-4 text-base xl:h-8 xl:px-2.5 xl:text-sm";
