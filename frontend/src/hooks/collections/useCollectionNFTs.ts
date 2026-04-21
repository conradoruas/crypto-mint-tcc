"use client";

import { useCallback, useEffect } from "react";
import { logger } from "@/lib/logger";
import {
  fetchCollectionNftsFromAlchemy,
  fetchCollectionNftsFromSubgraph,
} from "./collectionNftSources";
import { resolveCollectionNftSource } from "./collectionNftSourceSelector";
import { useCollectionNftPagination } from "./useCollectionNftPagination";
import { useCollectionNftState } from "./useCollectionNftState";

export function useCollectionNFTs(collectionAddress: string | undefined) {
  const source = resolveCollectionNftSource();
  const {
    nfts,
    setNfts,
    isLoading,
    setIsLoading,
    isLoadingMore,
    setIsLoadingMore,
    totalSupply,
    setTotalSupply,
    hasMore,
    setHasMore,
    reset,
  } = useCollectionNftState();
  const {
    read: cursorRead,
    reset: cursorReset,
    advanceSubgraph,
    setAlchemyPageKey,
  } = useCollectionNftPagination();

  const loadInitialPage = useCallback(async () => {
    if (!collectionAddress) {
      setIsLoading(false);
      reset();
      return;
    }

    setIsLoading(true);

    try {
      if (source === "subgraph") {
        const result = await fetchCollectionNftsFromSubgraph(collectionAddress, 0);
        setNfts(result.items);
        setTotalSupply(result.totalCount);
        setHasMore(result.hasMore);
        advanceSubgraph(result.items.length);
        return;
      }

      const result = await fetchCollectionNftsFromAlchemy(collectionAddress);
      setNfts(result.items);
      setTotalSupply(result.totalCount);
      setHasMore(!!result.nextPageKey);
      setAlchemyPageKey(result.nextPageKey);
    } catch (error) {
      logger.error("Erro ao buscar NFTs da coleção", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    advanceSubgraph,
    collectionAddress,
    reset,
    setAlchemyPageKey,
    setHasMore,
    setIsLoading,
    setNfts,
    setTotalSupply,
    source,
  ]);

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
      if (source === "subgraph") {
        const result = await fetchCollectionNftsFromSubgraph(
          collectionAddress,
          cursorRead().subgraphSkip,
        );
        setNfts((previous) => [...previous, ...result.items]);
        setHasMore(result.hasMore);
        advanceSubgraph(result.items.length);
        return;
      }

      const result = await fetchCollectionNftsFromAlchemy(
        collectionAddress,
        cursorRead().alchemyPageKey,
      );
      setNfts((previous) => [...previous, ...result.items]);
      setHasMore(!!result.nextPageKey);
      setAlchemyPageKey(result.nextPageKey);
    } catch (error) {
      logger.error("Erro ao buscar mais NFTs", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    advanceSubgraph,
    collectionAddress,
    cursorRead,
    hasMore,
    isLoadingMore,
    setAlchemyPageKey,
    setHasMore,
    setIsLoadingMore,
    setNfts,
    source,
  ]);

  return {
    nfts,
    isLoading,
    isLoadingMore,
    totalSupply,
    hasMore,
    loadMore,
  };
}
