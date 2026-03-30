"use client";

import { useEffect } from "react";

/**
 * Runs a callback when a click occurs outside the referenced element.
 * Shared utility extracted from NavBar for reuse across dropdowns.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  cb: () => void,
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}
