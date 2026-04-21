"use client";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

import { useMemo } from "react";
import { useCollections } from "@/hooks/collections";
import {
  mapCollectionSuggestions,
  mapFallbackCollections,
  mapNftSuggestions,
} from "./searchResultMappers";
import { useGlobalSearchMetadata } from "./useGlobalSearchMetadata";
import { useGlobalSearchSuggestions } from "./useGlobalSearchSuggestions";

export function useGlobalSearchResults(trimmed: string, debounced: string) {
  const { collections } = useCollections();
  const { data: suggestionsData } = useGlobalSearchSuggestions(debounced);
  const { metaMap } = useGlobalSearchMetadata(suggestionsData?.nfts);

  const collectionResults = useMemo(() => {
    if (trimmed.length < 1) {
      return [];
    }

    if (SUBGRAPH_ENABLED && suggestionsData) {
      return mapCollectionSuggestions(suggestionsData.collections);
    }

    return mapFallbackCollections(collections, trimmed);
  }, [collections, suggestionsData, trimmed]);

  const nftResults = useMemo(
    () => (SUBGRAPH_ENABLED && trimmed.length >= 1 ? suggestionsData?.nfts ?? [] : []),
    [suggestionsData?.nfts, trimmed],
  );

  const mappedNftResults = useMemo(
    () => mapNftSuggestions(nftResults, metaMap),
    [metaMap, nftResults],
  );

  return {
    collectionResults,
    nftResults: mappedNftResults,
    hasResults:
      collectionResults.length > 0 || mappedNftResults.length > 0,
  };
}
