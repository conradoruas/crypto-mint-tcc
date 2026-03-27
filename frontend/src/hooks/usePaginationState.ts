import { useState } from "react";

/**
 * Encapsulates a single pagination cursor and the derived slice/totalPages
 * computation for a given page size.
 *
 * Usage:
 *   const pag = usePaginationState(8);
 *   const { items, totalPages } = pag.paginate(allItems);
 *   // navigate: pag.prev() / pag.next(totalPages) / pag.goTo(n) / pag.reset()
 */
export function usePaginationState(pageSize: number) {
  const [page, setPage] = useState(1);

  function paginate<T>(items: T[]): { items: T[]; totalPages: number } {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      totalPages,
    };
  }

  function reset() {
    setPage(1);
  }

  function prev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function next(totalPages: number) {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function goTo(target: number) {
    setPage(target);
  }

  return { page, setPage, paginate, reset, prev, next, goTo };
}
