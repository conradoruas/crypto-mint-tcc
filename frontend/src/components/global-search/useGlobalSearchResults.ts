"use client";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

import { useMemo } from "react";
import { useQuery as useApolloQuery } from "@apollo/client/react";
import { useQuery } from "@tanstack/react-query";
import { useCollections } from "@/hooks/collections";
import { GET_SEARCH_SUGGESTIONS } from "@/lib/graphql/queries";
import { fetchBatchNFTMetadata } from "@/lib/nftMetadata";
import type { NFTMeta } from "@/types/alchemy";

type GqlSuggestionsData = {
  collections: {
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    totalSupply: string;
  }[];
  nfts: {
    id: string;
    tokenId: string;
    collection: { contractAddress: string; name: string; symbol: string };
  }[];
};

export function useGlobalSearchResults(trimmed: string, debounced: string) {
  const { collections } = useCollections();

  const { data: suggestionsData } = useApolloQuery<GqlSuggestionsData>(
    GET_SEARCH_SUGGESTIONS,
    {
      variables: { q: debounced, limit: 5 },
      skip: !SUBGRAPH_ENABLED || debounced.length < 2,
      fetchPolicy: "cache-first",
    },
  );

  const nftTokens = useMemo(
    () =>
      (suggestionsData?.nfts ?? []).map((nft) => ({
        contractAddress: nft.collection.contractAddress,
        tokenId: nft.tokenId,
      })),
    [suggestionsData?.nfts],
  );

  const { data: metaMap = new Map<string, NFTMeta>() } = useQuery({
    queryKey: [
      "search-meta",
      nftTokens.map((token) => `${token.contractAddress}-${token.tokenId}`),
    ],
    queryFn: () => fetchBatchNFTMetadata(nftTokens),
    enabled: nftTokens.length > 0,
    staleTime: 5 * 60_000,
  });

  const collectionResults = useMemo(() => {
    if (trimmed.length < 1) {
      return [];
    }

    if (SUBGRAPH_ENABLED && suggestionsData) {
      return suggestionsData.collections.slice(0, 5);
    }

    return collections
      .filter(
        (collection) =>
          collection.name.toLowerCase().includes(trimmed) ||
          collection.symbol.toLowerCase().includes(trimmed) ||
          collection.contractAddress.toLowerCase().includes(trimmed),
      )
      .slice(0, 5)
      .map((collection) => ({
        id: collection.contractAddress,
        contractAddress: collection.contractAddress,
        name: collection.name,
        symbol: collection.symbol,
        image: collection.image ?? "",
        totalSupply: collection.totalSupply?.toString() ?? undefined,
      }));
  }, [collections, suggestionsData, trimmed]);

  const nftResults = useMemo(
    () => (SUBGRAPH_ENABLED && trimmed.length >= 1 ? suggestionsData?.nfts ?? [] : []),
    [suggestionsData?.nfts, trimmed],
  );

  const mappedNftResults = useMemo(
    () =>
      nftResults.map((nft) => {
        const metaKey = `${nft.collection.contractAddress.toLowerCase()}-${nft.tokenId}`;
        const meta = metaMap.get(metaKey);
        return {
          id: nft.id,
          href: `/asset/${nft.tokenId}?contract=${nft.collection.contractAddress}`,
          contractAddress: nft.collection.contractAddress,
          tokenId: nft.tokenId,
          collectionName: nft.collection.name,
          image: meta?.image ?? "",
          name: meta?.name ?? `#${nft.tokenId.padStart(3, "0")}`,
        };
      }),
    [metaMap, nftResults],
  );

  return {
    collectionResults,
    nftResults: mappedNftResults,
    hasResults:
      collectionResults.length > 0 || mappedNftResults.length > 0,
  };
}
