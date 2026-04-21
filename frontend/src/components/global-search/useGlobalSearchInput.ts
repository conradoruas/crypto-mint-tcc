"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEBOUNCE_MS = 200;

export function useGlobalSearchInput() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebounced(query.trim().toLowerCase()),
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(id);
  }, [query]);

  return {
    query,
    setQuery,
    open,
    setOpen,
    debounced,
    trimmed: useMemo(() => query.trim().toLowerCase(), [query]),
    containerRef,
  };
}
