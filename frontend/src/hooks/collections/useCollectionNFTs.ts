"use client";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionNFTItem } from "@/types/nft";
import { logger } from "@/lib/logger";
import {
  fetchCollectionNftsFromAlchemy,
  fetchCollectionNftsFromSubgraph,
} from "./collectionNftSources";

type PaginationCursor = {
  alchemyPageKey?: string;
  subgraphSkip: number;
};

function useCollectionNftCursor() {
  const cursorRef = useRef<PaginationCursor>({
    alchemyPageKey: undefined,
    subgraphSkip: 0,
  });

  const reset = useCallback(() => {
    cursorRef.current = { alchemyPageKey: undefined, subgraphSkip: 0 };
  }, []);

  const read = useCallback(() => cursorRef.current, []);

  const updateSubgraph = useCallback((loadedCount: number) => {
    cursorRef.current.subgraphSkip += loadedCount;
  }, []);

  const updateAlchemy = useCallback((nextPageKey?: string) => {
    cursorRef.current.alchemyPageKey = nextPageKey;
  }, []);

  return { read, reset, updateSubgraph, updateAlchemy };
}

export function useCollectionNFTs(collectionAddress: string | undefined) {
  const [nfts, setNfts] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalSupply, setTotalSupply] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Destructure stable callbacks from the cursor hook so they can be used
  // individually as useCallback/useEffect deps. The wrapper object returned by
  // useCollectionNftCursor() is a new reference on every render even though
  // its members are stable useCallback refs — using the object directly as a
  // dep causes loadInitialPage to be recreated every render, which re-triggers
  // the effect, which calls setIsLoading(true), which re-renders, infinitely.
  const { read: cursorRead, reset: cursorReset, updateSubgraph, updateAlchemy } = useCollectionNftCursor();

  const loadInitialPage = useCallback(async () => {
    if (!collectionAddress) {
      setIsLoading(false);
      setNfts([]);
      setHasMore(false);
      return;
    }

    setIsLoading(true);

    try {
      if (SUBGRAPH_ENABLED) {
        const result = await fetchCollectionNftsFromSubgraph(collectionAddress, 0);
        setNfts(result.items);
        setTotalSupply(result.totalCount);
        setHasMore(result.hasMore);
        updateSubgraph(result.items.length);
        return;
      }

      const result = await fetchCollectionNftsFromAlchemy(collectionAddress);
      setNfts(result.items);
      setTotalSupply(result.totalCount);
      setHasMore(!!result.nextPageKey);
      updateAlchemy(result.nextPageKey);
    } catch (error) {
      logger.error("Erro ao buscar NFTs da coleção", error);
    } finally {
      setIsLoading(false);
    }
  }, [collectionAddress, updateSubgraph, updateAlchemy]);

  useEffect(() => {
    cursorReset();
    void loadInitialPage();
  }, [cursorReset, loadInitialPage]);

  const loadMore = useCallback(async () => {
    if (!collectionAddress || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      if (SUBGRAPH_ENABLED) {
        const result = await fetchCollectionNftsFromSubgraph(
          collectionAddress,
          cursorRead().subgraphSkip,
        );
        setNfts((previous) => [...previous, ...result.items]);
        setHasMore(result.hasMore);
        updateSubgraph(result.items.length);
        return;
      }

      const result = await fetchCollectionNftsFromAlchemy(
        collectionAddress,
        cursorRead().alchemyPageKey,
      );
      setNfts((previous) => [...previous, ...result.items]);
      setHasMore(!!result.nextPageKey);
      updateAlchemy(result.nextPageKey);
    } catch (error) {
      logger.error("Erro ao buscar mais NFTs", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [collectionAddress, cursorRead, updateSubgraph, updateAlchemy, hasMore, isLoadingMore]);

  return { nfts, isLoading, isLoadingMore, totalSupply, hasMore, loadMore };
}
