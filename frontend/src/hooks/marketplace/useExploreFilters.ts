"use client";

import { useState } from "react";
import type { SortOption } from "./filterModel";

export interface ExploreFilters {
  selectedCollection: string;
  search: string;
  sort: SortOption;
  onlyListed: boolean;
  onlyFavorites: boolean;
  page: number;
}

export interface ExploreFilterActions {
  setSelectedCollection: (v: string) => void;
  setSearch: (v: string) => void;
  setSort: (v: SortOption) => void;
  setOnlyListed: (v: boolean) => void;
  setOnlyFavorites: (v: boolean) => void;
  /** Accepts a plain number or an updater function, matching React's setState signature. */
  setPage: (v: number | ((prev: number) => number)) => void;
  clearFilters: () => void;
}

const DEFAULT_FILTERS: ExploreFilters = {
  selectedCollection: "",
  search: "",
  sort: "default",
  onlyListed: false,
  onlyFavorites: false,
  page: 1,
};

export function useExploreFilters(initialSearch = ""): ExploreFilters & ExploreFilterActions & {
  hasActiveFilters: boolean;
} {
  const [selectedCollection, setSelectedCollectionRaw] = useState("");
  const [search, setSearchRaw] = useState(initialSearch);
  const [sort, setSortRaw] = useState<SortOption>("default");
  const [onlyListed, setOnlyListedRaw] = useState(false);
  const [onlyFavorites, setOnlyFavoritesRaw] = useState(false);
  const [page, setPageRaw] = useState(1);

  const setPage = (v: number | ((prev: number) => number)) => setPageRaw(v);

  const setSelectedCollection = (v: string) => { setSelectedCollectionRaw(v); setPageRaw(1); };
  const setSearch = (v: string) => { setSearchRaw(v); setPageRaw(1); };
  const setSort = (v: SortOption) => { setSortRaw(v); setPageRaw(1); };
  const setOnlyListed = (v: boolean) => { setOnlyListedRaw(v); setPageRaw(1); };
  const setOnlyFavorites = (v: boolean) => { setOnlyFavoritesRaw(v); setPageRaw(1); };

  const clearFilters = () => {
    setSearchRaw(DEFAULT_FILTERS.search);
    setSortRaw(DEFAULT_FILTERS.sort);
    setOnlyListedRaw(DEFAULT_FILTERS.onlyListed);
    setOnlyFavoritesRaw(DEFAULT_FILTERS.onlyFavorites);
    setSelectedCollectionRaw(DEFAULT_FILTERS.selectedCollection);
    setPage(1);
  };

  const hasActiveFilters =
    search !== "" ||
    sort !== "default" ||
    onlyListed ||
    onlyFavorites ||
    selectedCollection !== "";

  return {
    selectedCollection,
    search,
    sort,
    onlyListed,
    onlyFavorites,
    page,
    setSelectedCollection,
    setSearch,
    setSort,
    setOnlyListed,
    setOnlyFavorites,
    setPage,
    clearFilters,
    hasActiveFilters,
  };
}
