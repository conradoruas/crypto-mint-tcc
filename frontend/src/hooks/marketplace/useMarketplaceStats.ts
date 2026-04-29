"use client";

import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { GET_MARKETPLACE_STATS } from "@/lib/graphql/queries";
import { POLL_STATS_MS } from "@/constants/polling";
import type { MarketplaceStats } from "@/types/marketplace";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";
import { useSubgraphState } from "@/lib/subgraphState";
import type { SubgraphState } from "@/lib/subgraphErrors";
import { useRefetchOnWindowFocus } from "@/hooks/useRefetchOnWindowFocus";

export type { MarketplaceStats };

type GqlStatsData = {
  marketplaceStats: {
    totalCollections: string;
    totalNFTs: string;
    totalListed: string;
    totalVolume: string;
    totalSales: string;
  } | null;
};

export interface MarketplaceStatsResult extends MarketplaceStats {
  subgraphState: SubgraphState;
}

export function useMarketplaceStats(): MarketplaceStatsResult {
  const subgraphState = useSubgraphState();

  const {
    data: gqlData,
    loading: gqlLoading,
    refetch,
  } = useQuery<GqlStatsData>(GET_MARKETPLACE_STATS, {
    skip: !SUBGRAPH_ENABLED,
    pollInterval: POLL_STATS_MS,
  });

  useRefetchOnWindowFocus(refetch, { enabled: SUBGRAPH_ENABLED });

  const s = gqlData?.marketplaceStats;
  return {
    totalCollections: Number(s?.totalCollections ?? 0),
    totalNFTs: Number(s?.totalNFTs ?? 0),
    totalListed: Math.max(0, Number(s?.totalListed ?? 0)),
    volumeETH: s?.totalVolume
      ? parseFloat(formatEther(BigInt(s.totalVolume))).toFixed(4)
      : "0",
    isLoading: gqlLoading,
    subgraphState,
  };
}
