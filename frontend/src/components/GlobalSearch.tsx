"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";
import { GlobalSearchResults } from "./global-search/GlobalSearchResults";
import { useGlobalSearchInput } from "./global-search/useGlobalSearchInput";
import { useGlobalSearchResults } from "./global-search/useGlobalSearchResults";

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const {
    query,
    setQuery,
    open,
    setOpen,
    debounced,
    trimmed,
    containerRef,
  } = useGlobalSearchInput();
  const results = useGlobalSearchResults(trimmed, debounced);

  useClickOutside(containerRef, () => setOpen(false));

  const clear = () => {
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none z-10" />
      <input
        type="text"
        role="combobox"
        aria-controls="search-results-listbox"
        aria-haspopup="listbox"
        aria-expanded={open && trimmed.length >= 1}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (trimmed) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clear();
          }

          if (event.key === "Enter" && trimmed) {
            router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
            clear();
          }
        }}
        placeholder="Search collections, NFTs..."
        aria-label="Search collections and NFTs"
        aria-autocomplete="list"
        className="bg-surface-container-lowest border border-outline-variant/15 rounded-sm py-2 pl-10 pr-8 text-sm w-full focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/50 text-on-surface"
      />

      {query && (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X size={12} />
        </button>
      )}

      <GlobalSearchResults
        open={open}
        query={query}
        trimmed={trimmed}
        hasResults={results.hasResults}
        collectionResults={results.collectionResults}
        nftResults={results.nftResults}
        onSelect={clear}
      />
    </div>
  );
}
