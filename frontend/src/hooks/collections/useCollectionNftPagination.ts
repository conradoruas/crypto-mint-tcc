"use client";

import { useCallback, useRef } from "react";

export type CollectionNftCursor = {
  alchemyPageKey?: string;
  subgraphSkip: number;
};

export function useCollectionNftPagination() {
  const cursorRef = useRef<CollectionNftCursor>({
    alchemyPageKey: undefined,
    subgraphSkip: 0,
  });

  const reset = useCallback(() => {
    cursorRef.current = { alchemyPageKey: undefined, subgraphSkip: 0 };
  }, []);

  const read = useCallback(() => cursorRef.current, []);

  const advanceSubgraph = useCallback((loadedCount: number) => {
    cursorRef.current.subgraphSkip += loadedCount;
  }, []);

  const setAlchemyPageKey = useCallback((nextPageKey?: string) => {
    cursorRef.current.alchemyPageKey = nextPageKey;
  }, []);

  return { read, reset, advanceSubgraph, setAlchemyPageKey };
}
