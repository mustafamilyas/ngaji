"use client";

import { createContext, useContext } from "react";
import type { TagOwnerGroup } from "@/lib/tag/list";

type TagOptions = { options: TagOwnerGroup[]; canCreate: boolean };

const TagOptionsContext = createContext<TagOptions | null>(null);

/**
 * Holds the usable-tag options once for a list page, so each row's picker reads them from here instead of
 * every row carrying its own copy in the page payload.
 */
export function TagOptionsProvider({ options, canCreate, children }: TagOptions & { children: React.ReactNode }) {
  return <TagOptionsContext.Provider value={{ options, canCreate }}>{children}</TagOptionsContext.Provider>;
}

export function useTagOptions(): TagOptions | null {
  return useContext(TagOptionsContext);
}
