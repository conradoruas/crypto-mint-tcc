"use client";

import { useCallback, useState } from "react";
import type { CollectionNFTItem } from "@/types/nft";

export function useCollectionNftState() {
  const [nfts, setNfts] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalSupply, setTotalSupply] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const reset = useCallback(() => {
    setNfts([]);
    setTotalSupply(0);
    setHasMore(false);
  }, []);

  return {
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
  };
}
