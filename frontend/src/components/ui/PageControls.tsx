"use client";

/** Full-featured pager with prev/next buttons and an ellipsis window.
 * Only renders when totalPages > 1.
 */
export function PageControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  setPage,
  className = "mt-12",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div
      className={`flex items-center justify-between pt-6 border-t border-outline-variant/10 ${className}`}
    >
      <p className="text-xs text-on-surface-variant uppercase tracking-widest">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of{" "}
        {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Prev
        </button>
        {pages.map((p, idx) =>
          p === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 text-on-surface-variant/40 text-xs"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p as number)}
              className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${
                page === p
                  ? "bg-primary text-on-primary border-primary"
                  : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:border-outline disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}
