"use client";
import { SUBGRAPH_ENABLED } from "@/lib/env";

import { useMemo } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { useQuery as useRqQuery } from "@tanstack/react-query";
import {
  GET_COLLECTION_STATS_RANKED,
  GET_TOP_OFFERS_BY_COLLECTION,
} from "@/lib/graphql/queries";
import { POLL_TRENDING_MS } from "@/constants/polling";
import { useNowBucketed } from "../useNowBucketed";
import { logger } from "@/lib/logger";
import type { TrendingCollection } from "@/types/collection";

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

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

/**
 * Fetches trending collections ranked by 24h volume.
 *
 * Previous implementation scanned up to 1200 entities (activityEvents +
 * listings + offers) and aggregated on the client. Now the subgraph
 * maintains `CollectionStat.volume24h` with day-based resets and we
 * query a single pre-sorted entity list.
 */
export function useTrendingCollections(limit = 10) {
  const nowBucketed = useNowBucketed();

  const {
    data,
    loading: gqlLoading,
    error,
  } = useQuery<GqlCollectionStatsData>(GET_COLLECTION_STATS_RANKED, {
    skip: !SUBGRAPH_ENABLED,
    variables: { first: limit },
    pollInterval: POLL_TRENDING_MS,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  if (error) logger.error("[useTrendingCollections] GQL Error", error);

  type GqlTopOffer = { nftContract: string; amount: string };
  const { data: offersData } = useQuery<{ offers: GqlTopOffer[] }>(
    GET_TOP_OFFERS_BY_COLLECTION,
    {
      skip: !SUBGRAPH_ENABLED,
      variables: { now: nowBucketed },
      pollInterval: POLL_TRENDING_MS,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  );

  // Contract addresses change only when the stats list changes — stable key.
  const contractAddresses = useMemo(
    () => (data?.collectionStats ?? []).map((s) => s.collection.contractAddress),
    [data],
  );

  // Owner counts are non-critical; failures leave owners at 0.
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
    enabled: SUBGRAPH_ENABLED && contractAddresses.length > 0,
    staleTime: 5 * 60_000,
    throwOnError: false,
  });

  const trending = useMemo<TrendingCollection[]>(() => {
    if (!SUBGRAPH_ENABLED || !data) return [];

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
  }, [data, offersData, ownerCountMap]);

  return { trending, isLoading: gqlLoading };
}

