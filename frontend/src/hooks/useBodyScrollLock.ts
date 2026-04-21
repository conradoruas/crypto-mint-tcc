"use client";

import { useEffect } from "react";

/** Locks `document.body` scroll while `active` is true. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (active) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);
}
