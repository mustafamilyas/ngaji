"use client";

import { useEffect, useRef } from "react";

/**
 * Brings the active tab into view when the strip scrolls sideways (a narrow screen), so the current tab is
 * never hidden off the edge. Renders nothing; it finds its `<nav>` and the `aria-current="page"` link inside it.
 * Only the strip's own `scrollLeft` is changed, never the page's scroll, and nothing moves when the tab is visible.
 */
export function ScrollActiveTabIntoView({ current }: { current: string }) {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nav = marker.current?.closest("nav");
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const strip = nav.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left >= strip.left && tab.right <= strip.right) return;
    // Center the tab in the strip; the browser clamps to the scrollable range.
    nav.scrollLeft += tab.left - strip.left - (nav.clientWidth - tab.width) / 2;
  }, [current]);

  return <span ref={marker} hidden />;
}
