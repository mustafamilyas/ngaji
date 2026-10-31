"use client";

import { useSyncExternalStore } from "react";

/** Below this the visual viewport only moved a little (URL bar, rubber-banding), not an on-screen keyboard. */
const MIN_KEYBOARD_PX = 80;

/** Height of whatever covers the bottom of the layout viewport (the on-screen keyboard), in px; 0 when nothing does. */
export function keyboardInset(win: Pick<Window, "innerHeight" | "visualViewport">): number {
  const vv = win.visualViewport;
  if (!vv) return 0;
  const covered = Math.round(win.innerHeight - vv.height - vv.offsetTop);
  return covered >= MIN_KEYBOARD_PX ? covered : 0;
}

/**
 * Tracks the on-screen keyboard through `visualViewport`. iOS Safari and Chrome on Android keep the layout viewport
 * (and `dvh`) unchanged when the keyboard opens, so a bottom-fixed sheet would sit behind it. `0` on the server,
 * without `visualViewport`, and while `active` is false (no listeners are attached then).
 */
export function useKeyboardInset(active: boolean): number {
  return useSyncExternalStore(
    (notify) => {
      const vv = active ? window.visualViewport : null;
      if (!vv) return () => {};
      vv.addEventListener("resize", notify);
      vv.addEventListener("scroll", notify);
      return () => {
        vv.removeEventListener("resize", notify);
        vv.removeEventListener("scroll", notify);
      };
    },
    () => (active ? keyboardInset(window) : 0),
    () => 0,
  );
}
