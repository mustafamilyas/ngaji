"use client";

import { useSyncExternalStore } from "react";

/** Tailwind's `xl`: below it the app uses touch sizes and sheets instead of popovers. */
export const XL_QUERY = "(min-width: 1280px)";

/** Live `matchMedia` match; `false` on the server and on the first client render, so phones never flash a popover. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
