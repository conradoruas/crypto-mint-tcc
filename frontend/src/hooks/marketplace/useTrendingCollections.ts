"use client";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

import { useCallback, useMemo } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { useQuery as useRqQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import {
  GET_COLLECTION_STATS_RANKED,
  GET_TOP_OFFERS_BY_COLLECTION,
} from "@/lib/graphql/queries";
import { POLL_TRENDING_MS } from "@/constants/polling";
import { useNowBucketed } from "../useNowBucketed";
import { logger } from "@/lib/logger";
import {
  FACTORY_ADDRESS,
  NFT_COLLECTION_FACTORY_ABI,
} from "@/constants/contracts";
import { useSubgraphState } from "@/lib/subgraphState";
import type { SubgraphState } from "@/lib/subgraphErrors";
import { useRefetchOnWindowFocus } from "@/hooks/useRefetchOnWindowFocus";
import type { TrendingCollection, CollectionInfo } from "@/types/collection";

export type { TrendingCollection };


// ─── GraphQL response types ───

type GqlCollectionStats = {
  id: string;
  totalVolume: string;
  totalSales: string;
  floorPrice: string | null;
  floorPriceDayStart: string | null;
  volume24h: string;
  sales24h: string;
  collection: {
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    dailySnapshots: { dayId: string; floor: string | null }[];
  };
};

type GqlCollectionStatsData = {
  collectionStats: GqlCollectionStats[];
};

export interface TrendingCollectionsResult {
  trending: TrendingCollection[];
  isLoading: boolean;
  subgraphState: SubgraphState;
}

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

/**
 * Fetches trending collections ranked by 24h volume.
 *
 * Subgraph path (primary): pre-computed CollectionStat entities sorted by
 * volume24h with 14-day floor history.
 *
 * RPC fallback (when subgraphState is 'down'): "Recent collections" from
 * factory.getAllCollections(), sorted by createdAt desc, with stats fields
 * blanked. The user sees a meaningful list instead of an empty state.
 */
export function useTrendingCollections(limit = 10): TrendingCollectionsResult {
  const subgraphState = useSubgraphState();
  const isDown = subgraphState === "down";
  const useSubgraph = SUBGRAPH_ENABLED && !isDown;

  const nowBucketed = useNowBucketed();

  const {
    data,
    loading: gqlLoading,
    error,
    refetch: refetchStats,
  } = useQuery<GqlCollectionStatsData>(GET_COLLECTION_STATS_RANKED, {
    skip: !useSubgraph,
    variables: { first: limit },
    pollInterval: POLL_TRENDING_MS,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  if (error) logger.error("[useTrendingCollections] GQL Error", error);

  type GqlTopOffer = { nftContract: string; amount: string };
  const { data: offersData, refetch: refetchOffers } = useQuery<{
    offers: GqlTopOffer[];
  }>(GET_TOP_OFFERS_BY_COLLECTION, {
    skip: !useSubgraph,
    variables: { now: nowBucketed },
    pollInterval: POLL_TRENDING_MS,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const refetchAll = useCallback(() => {
    refetchStats();
    refetchOffers();
  }, [refetchStats, refetchOffers]);

  useRefetchOnWindowFocus(refetchAll, { enabled: useSubgraph });

  // ─── Subgraph-derived trending ───

  const contractAddresses = useMemo(
    () => (data?.collectionStats ?? []).map((s) => s.collection.contractAddress),
    [data],
  );

  const { data: ownerCountMap = {} } = useRqQuery<Record<string, number>>({
    queryKey: ["owner-counts", contractAddresses],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/alchemy/getOwnerCountsBatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddresses }),
        signal,
      });
      return res.json() as Promise<Record<string, number>>;
    },
    enabled: useSubgraph && contractAddresses.length > 0,
    staleTime: 5 * 60_000,
    throwOnError: false,
  });

  const subgraphTrending = useMemo<TrendingCollection[]>(() => {
    if (!useSubgraph || !data) return [];

    const stats = data.collectionStats ?? [];

    const topOfferByContract = new Map<string, bigint>();
    for (const o of offersData?.offers ?? []) {
      const key = o.nftContract.toLowerCase();
      if (!topOfferByContract.has(key)) {
        topOfferByContract.set(key, BigInt(o.amount));
      }
    }

    return stats.map((s) => {
      const vol24hWei = BigInt(s.volume24h ?? "0");
      const floorWei = s.floorPrice ? BigInt(s.floorPrice) : null;
      const floorStartWei = s.floorPriceDayStart
        ? BigInt(s.floorPriceDayStart)
        : null;

      let floorChange24h: number | null = null;
      if (floorWei !== null && floorStartWei !== null && floorStartWei > BigInt(0)) {
        const curr = parseFloat(formatEther(floorWei));
        const start = parseFloat(formatEther(floorStartWei));
        if (start > 0) floorChange24h = ((curr - start) / start) * 100;
      }

      return {
        contractAddress: s.collection.contractAddress,
        name: s.collection.name,
        symbol: s.collection.symbol ?? "",
        image: s.collection.image ?? "",
        floorPrice: floorWei ? parseFloat(formatEther(floorWei)).toFixed(4) : null,
        floorChange24h,
        topOffer: (() => {
          const wei = topOfferByContract.get(s.collection.contractAddress.toLowerCase());
          return wei ? parseFloat(formatEther(wei)).toFixed(4) : null;
        })(),
        sales24h: Number(s.sales24h ?? 0),
        owners: ownerCountMap[s.collection.contractAddress.toLowerCase()] ?? 0,
        listedPct: null,
        volume24h: parseFloat(formatEther(vol24hWei)).toFixed(4),
        floorHistory: (s.collection.dailySnapshots ?? [])
          .slice()
          .reverse()
          .map((d) => (d.floor ? parseFloat(formatEther(BigInt(d.floor))) : 0))
          .filter((v) => v > 0),
      } as TrendingCollection;
    });
  }, [useSubgraph, data, offersData, ownerCountMap]);

  // ─── RPC thin fallback (subgraph down) ───

  const { data: rpcAllCollections, isLoading: rpcLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getAllCollections",
    query: { enabled: isDown && !!FACTORY_ADDRESS },
  });

  const rpcTrending = useMemo<TrendingCollection[]>(() => {
    if (!isDown) return [];
    const list = (rpcAllCollections as CollectionInfo[] | undefined) ?? [];
    return list
      .slice()
      .sort((a, b) => Number(b.createdAt - a.createdAt))
      .slice(0, limit)
      .map((c) => ({
        contractAddress: c.contractAddress,
        name: c.name,
        symbol: c.symbol ?? "",
        image: c.image ?? "",
        floorPrice: null,
        floorChange24h: null,
        topOffer: null,
        sales24h: 0,
        owners: 0,
        listedPct: null,
        volume24h: "0",
        floorHistory: [],
      }));
  }, [isDown, rpcAllCollections, limit]);

  return {
    trending: isDown ? rpcTrending : subgraphTrending,
    isLoading: isDown ? rpcLoading : gqlLoading,
    subgraphState,
  };
}
