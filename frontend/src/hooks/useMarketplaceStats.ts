"use client";

import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { GET_MARKETPLACE_STATS } from "@/lib/graphql/queries";
import { POLL_STATS_MS } from "@/constants/polling";
import type { MarketplaceStats } from "@/types/marketplace";

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

export function useMarketplaceStats(): MarketplaceStats {
  const { data: gqlData, loading: gqlLoading } = useQuery<GqlStatsData>(
    GET_MARKETPLACE_STATS,
    { pollInterval: POLL_STATS_MS },
  );

  const s = gqlData?.marketplaceStats;
  return {
    totalCollections: Number(s?.totalCollections ?? 0),
    totalNFTs: Number(s?.totalNFTs ?? 0),
    totalListed: Number(s?.totalListed ?? 0),
    volumeETH: s?.totalVolume
      ? parseFloat(formatEther(BigInt(s.totalVolume))).toFixed(4)
      : "0",
    isLoading: gqlLoading,
  };
}
