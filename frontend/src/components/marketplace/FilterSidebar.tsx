import React from "react";
import type { CollectionInfo } from "@/types/collection";

export type SortOption =
  | "default"
  | "price_asc"
  | "price_desc"
  | "offer_desc"
  | "listed_first"
  | "id_asc"
  | "id_desc";

export const SORT_LABELS: Record<SortOption, string> = {
  default: "Default",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  offer_desc: "Top Offer",
  listed_first: "Listed First",
  id_asc: "ID Ascending",
  id_desc: "ID Descending",
};

interface FilterSidebarProps {
  hasActiveFilters: boolean;
  clearFilters: () => void;
  onlyListed: boolean;
  setOnlyListed: React.Dispatch<React.SetStateAction<boolean>>;
  onlyFavorites: boolean;
  setOnlyFavorites: React.Dispatch<React.SetStateAction<boolean>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  sort: SortOption;
  setSort: React.Dispatch<React.SetStateAction<SortOption>>;
  isLoadingCollections: boolean;
  collections: CollectionInfo[];
  selectedCollection: string;
  setSelectedCollection: React.Dispatch<React.SetStateAction<string>>;
}

export function FilterSidebar({
  hasActiveFilters,
  clearFilters,
  onlyListed,
  setOnlyListed,
  onlyFavorites,
  setOnlyFavorites,
  setPage,
  sort,
  setSort,
  isLoadingCollections,
  collections,
  selectedCollection,
  setSelectedCollection,
}: FilterSidebarProps) {
  return (
    <aside className="w-72 fixed h-[calc(100vh-6rem)] overflow-y-auto px-8 hidden xl:block no-scrollbar top-24">
      <div className="space-y-10 pt-4">
        <header className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold tracking-tight uppercase">
            Filters
          </h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest"
            >
              Reset
            </button>
          )}
        </header>

        {/* Status filter */}
        <section className="space-y-4">
          <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Status
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setOnlyListed(false);
                setOnlyFavorites(false);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                !onlyListed && !onlyFavorites
                  ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                  : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setOnlyListed(true);
                setOnlyFavorites(false);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                onlyListed
                  ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                  : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
              }`}
            >
              Buy Now
            </button>
            <button
              onClick={() => {
                setOnlyFavorites((v) => !v);
                setOnlyListed(false);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                onlyFavorites
                  ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                  : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
              }`}
            >
              Favorites
            </button>
          </div>
        </section>

        {/* Sort */}
        <section className="space-y-4">
          <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Sort By
          </h3>
          <div className="space-y-2">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setSort(key);
                  setPage(1);
                }}
                className={`w-full text-left px-3 py-2 rounded-sm text-sm transition-all ${
                  sort === key
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        </section>

        {/* Collections */}
        {!isLoadingCollections && collections.length > 0 && (
          <section className="space-y-4">
            <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Collections
            </h3>
            <div className="space-y-2">
              {[{ contractAddress: "", name: "All" }, ...collections].map(
                (c) => (
                  <label
                    key={c.contractAddress}
                    className="flex items-center space-x-3 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="collection"
                      checked={selectedCollection === c.contractAddress}
                      onChange={() => {
                        setSelectedCollection(c.contractAddress);
                        setPage(1);
                      }}
                      className="accent-primary"
                    />
                    <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      {c.name}
                    </span>
                  </label>
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
