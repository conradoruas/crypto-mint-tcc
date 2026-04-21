"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBatchNFTMetadata } from "@/lib/nftMetadata";
import type { NFTMeta } from "@/types/alchemy";
import type { GqlSuggestionsData } from "./useGlobalSearchSuggestions";

export function useGlobalSearchMetadata(
  nfts: GqlSuggestionsData["nfts"] | undefined,
) {
  const nftTokens = useMemo(
    () =>
      (nfts ?? []).map((nft) => ({
        contractAddress: nft.collection.contractAddress,
        tokenId: nft.tokenId,
      })),
    [nfts],
  );

  const query = useQuery({
    queryKey: [
      "search-meta",
      nftTokens.map((token) => `${token.contractAddress}-${token.tokenId}`),
    ],
    queryFn: () => fetchBatchNFTMetadata(nftTokens),
    enabled: nftTokens.length > 0,
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    metaMap: query.data ?? new Map<string, NFTMeta>(),
  };
}
