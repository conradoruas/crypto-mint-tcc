"use client";

import { X } from "lucide-react";
import type { CollectionInfo } from "@/types/collection";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { SORT_LABELS, type SortOption } from "@/hooks/marketplace/filterModel";
import { DynamicTraitFilters } from "@/components/explore/DynamicTraitFilters";
import type { TraitSchema, TraitFilters, TraitFilterValue, TraitOptionData } from "@/types/traits";

interface FilterSidebarProps {
  hasActiveFilters: boolean;
  clearFilters: () => void;
  onlyListed: boolean;
  setOnlyListed: (v: boolean) => void;
  onlyFavorites: boolean;
  setOnlyFavorites: (v: boolean) => void;
  sort: SortOption;
  setSort: (v: SortOption) => void;
  isLoadingCollections: boolean;
  collections: CollectionInfo[];
  selectedCollection: string;
  setSelectedCollection: (v: string) => void;
  // Trait filter props (optional — only shown when a v2 collection with schema is selected)
  traitSchema?: TraitSchema | null;
  traitOptionData?: Record<string, TraitOptionData[]>;
  traitFilters?: TraitFilters;
  onSetTraitFilter?: (key: string, value: TraitFilterValue | undefined) => void;
  onClearTraitFilters?: () => void;
  traitFilterStatus?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function FilterContent({
  hasActiveFilters,
  clearFilters,
  onlyListed,
  setOnlyListed,
  onlyFavorites,
  setOnlyFavorites,
  sort,
  setSort,
  isLoadingCollections,
  collections,
  selectedCollection,
  setSelectedCollection,
  traitSchema,
  traitOptionData,
  traitFilters,
  onSetTraitFilter,
  onClearTraitFilters,
  traitFilterStatus,
  onMobileClose,
}: Omit<FilterSidebarProps, "mobileOpen"> & { onMobileClose?: () => void }) {
  return (
    <div className="space-y-10 pt-4">
      <header className="flex items-center justify-between">
        <h2 className="font-headline text-lg font-bold tracking-tight uppercase">
          Filters
        </h2>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest"
            >
              Reset
            </button>
          )}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              aria-label="Close filters"
              className="touch-target xl:hidden text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Status filter */}
      <section className="space-y-4">
        <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          Status
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setOnlyFavorites(false)}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
              !onlyListed && !onlyFavorites
                ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setOnlyListed(true)}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
              onlyListed
                ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                : "bg-surface-container text-on-surface-variant border-outline-variant/15 hover:border-outline"
            }`}
          >
            Buy Now
          </button>
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
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
              onClick={() => setSort(key)}
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
            {[{ contractAddress: "", name: "All" }, ...collections].map((c) => (
              <label
                key={c.contractAddress}
                className="flex items-center space-x-3 cursor-pointer group"
              >
                <input
                  type="radio"
                  name="collection"
                  checked={selectedCollection === c.contractAddress}
                  onChange={() => setSelectedCollection(c.contractAddress)}
                  className="accent-primary"
                />
                <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                  {c.name}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic trait filters — only when a v2 collection with a schema is selected */}
      {traitSchema && traitFilters && onSetTraitFilter && onClearTraitFilters && (
        <DynamicTraitFilters
          schema={traitSchema}
          optionData={traitOptionData ?? {}}
          traitFilters={traitFilters}
          onSetTraitFilter={onSetTraitFilter}
          onClearTraitFilters={onClearTraitFilters}
        />
      )}

      {!traitSchema && traitFilterStatus && (
        <section className="space-y-3">
          <h3 className="font-headline text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Traits
          </h3>
          <p className="text-xs leading-relaxed text-on-surface-variant/80">
            {traitFilterStatus}
          </p>
        </section>
      )}
    </div>
  );
}

export function FilterSidebar(props: FilterSidebarProps) {
  const { mobileOpen, onMobileClose } = props;

  useBodyScrollLock(mobileOpen ?? false);

  return (
    <>
      {/* Desktop sidebar — xl+ only */}
      <aside className="w-72 shrink-0 hidden xl:block">
        <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto px-8 no-scrollbar">
          <FilterContent {...props} />
        </div>
      </aside>

      {/* Mobile drawer — shown when mobileOpen=true, hidden on xl+ */}
      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
            aria-hidden
          />
          {/* Drawer panel */}
          <aside className="relative ml-auto w-full max-w-xs h-full bg-background border-l border-outline-variant/15 overflow-y-auto px-6 py-6 no-scrollbar shadow-2xl">
            <FilterContent {...props} onMobileClose={onMobileClose} />
          </aside>
        </div>
      )}
    </>
  );
}
