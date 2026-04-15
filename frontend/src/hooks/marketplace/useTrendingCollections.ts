"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import {
  GET_COLLECTION_STATS_RANKED,
  GET_TOP_OFFERS_BY_COLLECTION,
} from "@/lib/graphql/queries";
import { POLL_TRENDING_MS } from "@/constants/polling";
import { useNowBucketed } from "../useNowBucketed";
import type { TrendingCollection } from "@/types/collection";

export type { TrendingCollection };

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

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
  const [trending, setTrending] = useState<TrendingCollection[]>([]);
  const [isLoading, setIsLoading] = useState(SUBGRAPH_ENABLED);
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

  useEffect(() => {
    // If subgraph is skipped or error occurs, we don't need to do anything here.
    if (!SUBGRAPH_ENABLED) return;
    if (error) {
      console.error("[useTrendingCollections] GQL Error:", error);
      return;
    }

    // If still query-loading or no data yet, wait.
    if (gqlLoading || !data) return;

    let cancelled = false;

    const build = async () => {
      const stats = data.collectionStats ?? [];

      // Results are sorted desc by amount, so the first occurrence per
      // contract is the top active offer for that collection.
      const topOfferByContract = new Map<string, bigint>();
      for (const o of offersData?.offers ?? []) {
        const key = o.nftContract.toLowerCase();
        if (!topOfferByContract.has(key)) {
          topOfferByContract.set(key, BigInt(o.amount));
        }
      }



      // If there are no collection stats yet (e.g. fresh subgraph), stop loading
      if (stats.length === 0) {
        if (!cancelled) {
          setTrending([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      const mapped: TrendingCollection[] = stats.map((s) => {
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
          floorPrice: floorWei
            ? parseFloat(formatEther(floorWei)).toFixed(4)
            : null,
          floorChange24h,
          topOffer: (() => {
            const wei = topOfferByContract.get(
              s.collection.contractAddress.toLowerCase(),
            );
            return wei
              ? parseFloat(formatEther(wei)).toFixed(4)
              : null;
          })(),
          sales24h: Number(s.sales24h ?? 0),
          owners: 0,
          listedPct: null,
          volume24h: parseFloat(formatEther(vol24hWei)).toFixed(4),
          floorHistory: (s.collection.dailySnapshots ?? [])
            .slice()
            .reverse()
            .map((d) =>
              d.floor ? parseFloat(formatEther(BigInt(d.floor))) : 0,
            )
            .filter((v) => v > 0),
        } as TrendingCollection;
      });

      // Fetch owner counts for the top collections (non-critical, best-effort)
      try {
        const res = await globalThis.fetch("/api/alchemy/getOwnerCountsBatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractAddresses: mapped.map((c) => c.contractAddress),
          }),
        });
        const ownerCountMap: Record<string, number> = await res.json();
        for (const entry of mapped) {
          entry.owners =
            ownerCountMap[entry.contractAddress.toLowerCase()] ?? 0;
        }
      } catch {
        // owner counts remain 0 — non-critical field
      }

      if (!cancelled) {
        setTrending(mapped);
        setIsLoading(false);
      }
    };

    void build();

    return () => {
      cancelled = true;
    };
  }, [data, offersData, gqlLoading, error]);

  return { trending, isLoading: gqlLoading || isLoading };
}

