export function Pagination({
  page,
  setPage,
  hasActiveFilters,
  totalFilteredPages,
  hasMore,
}: {
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  hasActiveFilters: boolean;
  totalFilteredPages?: number;
  hasMore: boolean;
}) {
  if (!(page > 1 || (hasActiveFilters ? (totalFilteredPages ?? 1) > 1 : hasMore))) {
    return null;
  }

  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t border-outline-variant/10">
      <p className="text-xs text-on-surface-variant uppercase tracking-widest">
        Page {page}
        {totalFilteredPages ? ` / ${totalFilteredPages}` : ""}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Prev
        </button>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={
            hasActiveFilters
              ? page >= (totalFilteredPages ?? 1)
              : !hasMore
          }
          className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}
