"use client";

import { useEffect, useRef } from "react";
import { FOCUS_REFETCH_THROTTLE_MS } from "@/constants/polling";

interface Options {
  /** Skip wiring the listeners entirely. */
  enabled?: boolean;
  /** Minimum time between refetches triggered by focus events. */
  throttleMs?: number;
}

/**
 * Calls `refetch` whenever the tab becomes visible or the window regains
 * focus, throttled to at most one call per `throttleMs`.
 *
 * Pairs with the slow polling cadence in constants/polling.ts: the user
 * gets fresh data when they look at the page (focus) without our hooks
 * firing background polls every few seconds.
 */
export function useRefetchOnWindowFocus(
  refetch: () => void | Promise<unknown>,
  options: Options = {},
): void {
  const { enabled = true, throttleMs = FOCUS_REFETCH_THROTTLE_MS } = options;

  // Keep the latest refetch in a ref so we don't reattach listeners every
  // render (callers commonly pass an inline function).
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let lastFiredAt = 0;

    const maybeRefetch = () => {
      const now = Date.now();
      if (now - lastFiredAt < throttleMs) return;
      lastFiredAt = now;
      void refetchRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefetch();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", maybeRefetch);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", maybeRefetch);
    };
  }, [enabled, throttleMs]);
}
