import { useState, useCallback, useMemo } from "react";

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

  // Memoiza a função de paginação
  const paginate = useCallback(
    <T>(items: T[]): { items: T[]; totalPages: number } => {
      const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        totalPages,
      };
    },
    [page, pageSize],
  );

  // Memoiza o reset para ser estável
  const reset = useCallback(() => {
    setPage(1);
  }, []);

  const prev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const next = useCallback((totalPages: number) => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, []);

  const goTo = useCallback((target: number) => {
    setPage(target);
  }, []);

  // Memoiza o objeto de retorno para que a referência só mude se o estado mudar
  return useMemo(
    () => ({
      page,
      setPage,
      paginate,
      reset,
      prev,
      next,
      goTo,
    }),
    [page, paginate, reset, prev, next, goTo],
  );
}
