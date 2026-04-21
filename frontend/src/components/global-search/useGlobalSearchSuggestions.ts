"use client";

import { useQuery as useApolloQuery } from "@apollo/client/react";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";
import { GET_SEARCH_SUGGESTIONS } from "@/lib/graphql/queries";

export type GqlSuggestionsData = {
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

export function useGlobalSearchSuggestions(debounced: string) {
  return useApolloQuery<GqlSuggestionsData>(GET_SEARCH_SUGGESTIONS, {
    variables: { q: debounced, limit: 5 },
    skip: !SUBGRAPH_ENABLED || debounced.length < 2,
    fetchPolicy: "cache-first",
  });
}
