"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SortOption } from "./filterModel";
import type { TraitFilters, TraitFilterValue } from "@/types/traits";

export interface ExploreFilters {
  selectedCollection: string;
  search: string;
  sort: SortOption;
  onlyListed: boolean;
  onlyFavorites: boolean;
  traitFilters: TraitFilters;
  page: number;
}

export interface ExploreFilterActions {
  setSelectedCollection: (v: string) => void;
  setSearch: (v: string) => void;
  setSort: (v: SortOption) => void;
  setOnlyListed: (v: boolean) => void;
  setOnlyFavorites: (v: boolean) => void;
  setTraitFilter: (key: string, value: TraitFilterValue | undefined) => void;
  clearTraitFilters: () => void;
  setPage: (v: number | ((prev: number) => number)) => void;
  clearFilters: () => void;
}

const VALID_SORTS: SortOption[] = [
  "default", "price_asc", "price_desc", "offer_desc",
  "listed_first", "id_asc", "id_desc", "rarity_rank_asc", "rarity_rank_desc",
];

// ── URL codec ────────────────────────────────────────────────────────────────

function encodeTraitFilters(tf: TraitFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(tf)) {
    if (Array.isArray(val) && val.length > 0) {
      out[`t.${key}`] = val.join(",");
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const range = val as { min?: number; max?: number };
      const parts = [range.min ?? "", range.max ?? ""].join(":");
      if (parts !== ":") out[`t.${key}`] = parts;
    } else if (typeof val === "boolean") {
      out[`t.${key}`] = val ? "true" : "false";
    }
  }
  return out;
}

function decodeTraitFilters(params: URLSearchParams): TraitFilters {
  const tf: TraitFilters = {};
  params.forEach((val, key) => {
    if (!key.startsWith("t.")) return;
    const traitKey = key.slice(2);
    if (val === "true" || val === "false") {
      tf[traitKey] = val === "true";
    } else if (/^-?\d*(\.\d*)?:-?\d*(\.\d*)?$/.test(val)) {
      const [minStr, maxStr] = val.split(":");
      const range: { min?: number; max?: number } = {};
      if (minStr) range.min = Number(minStr);
      if (maxStr) range.max = Number(maxStr);
      tf[traitKey] = range;
    } else {
      tf[traitKey] = val.split(",").filter(Boolean);
    }
  });
  return tf;
}

function buildUrl(params: URLSearchParams): string {
  const s = params.toString();
  return s ? `?${s}` : "?";
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExploreFilters(): ExploreFilters & ExploreFilterActions & {
  hasActiveFilters: boolean;
} {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read current state from URL
  const selectedCollection = searchParams.get("col") ?? "";
  const search = searchParams.get("q") ?? "";
  const sortRaw = searchParams.get("sort") ?? "default";
  const sort: SortOption = VALID_SORTS.includes(sortRaw as SortOption)
    ? (sortRaw as SortOption)
    : "default";
  const onlyListed = searchParams.get("listed") === "1";
  const onlyFavorites = searchParams.get("fav") === "1";
  const page = Math.max(1, Number(searchParams.get("p") ?? "1") || 1);
  const traitFilters = useMemo(() => decodeTraitFilters(searchParams), [searchParams]);

  // Helper: update a single param and push to URL
  const patch = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      }
      if (resetPage) next.delete("p");
      router.replace(buildUrl(next), { scroll: false });
    },
    [router, searchParams],
  );

  const setSelectedCollection = useCallback(
    (v: string) => {
      // Clear trait filters when switching collections
      const next = new URLSearchParams();
      if (v) next.set("col", v);
      const q = searchParams.get("q");
      if (q) next.set("q", q);
      const ls = searchParams.get("listed");
      if (ls) next.set("listed", ls);
      router.replace(buildUrl(next), { scroll: false });
    },
    [router, searchParams],
  );

  const setSearch = useCallback(
    (v: string) => patch({ q: v || null }),
    [patch],
  );

  const setSort = useCallback(
    (v: SortOption) => patch({ sort: v === "default" ? null : v }),
    [patch],
  );

  const setOnlyListed = useCallback(
    (v: boolean) => patch({ listed: v ? "1" : null, fav: null }),
    [patch],
  );

  const setOnlyFavorites = useCallback(
    (v: boolean) => patch({ fav: v ? "1" : null, listed: null }),
    [patch],
  );

  const setPage = useCallback(
    (v: number | ((prev: number) => number)) => {
      const next = typeof v === "function" ? v(page) : v;
      patch({ p: next > 1 ? String(next) : null }, false);
    },
    [page, patch],
  );

  const setTraitFilter = useCallback(
    (key: string, value: TraitFilterValue | undefined) => {
      const next = new URLSearchParams(searchParams.toString());
      const urlKey = `t.${key}`;
      if (value === undefined) {
        next.delete(urlKey);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          next.delete(urlKey);
        } else {
          next.set(urlKey, value.join(","));
        }
      } else if (typeof value === "boolean") {
        next.set(urlKey, value ? "true" : "false");
      } else {
        const range = value as { min?: number; max?: number };
        const s = [range.min ?? "", range.max ?? ""].join(":");
        if (s === ":") {
          next.delete(urlKey);
        } else {
          next.set(urlKey, s);
        }
      }
      next.delete("p");
      router.replace(buildUrl(next), { scroll: false });
    },
    [router, searchParams],
  );

  const clearTraitFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.forEach((_, k) => {
      if (k.startsWith("t.")) next.delete(k);
    });
    next.delete("p");
    router.replace(buildUrl(next), { scroll: false });
  }, [router, searchParams]);

  const clearFilters = useCallback(() => {
    const col = searchParams.get("col");
    const next = new URLSearchParams();
    if (col) next.set("col", col);
    router.replace(buildUrl(next), { scroll: false });
  }, [router, searchParams]);

  const hasActiveFilters =
    search !== "" ||
    sort !== "default" ||
    onlyListed ||
    onlyFavorites ||
    selectedCollection !== "" ||
    Object.keys(traitFilters).length > 0;

  return {
    selectedCollection,
    search,
    sort,
    onlyListed,
    onlyFavorites,
    traitFilters,
    page,
    setSelectedCollection,
    setSearch,
    setSort,
    setOnlyListed,
    setOnlyFavorites,
    setTraitFilter,
    clearTraitFilters,
    setPage,
    clearFilters,
    hasActiveFilters,
  };
}

// Keep backward-compat export (initialSearch ignored; q param takes precedence)
export { encodeTraitFilters };
