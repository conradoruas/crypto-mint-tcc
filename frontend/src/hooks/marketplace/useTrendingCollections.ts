"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { GET_COLLECTION_STATS_RANKED } from "@/lib/graphql/queries";
import { POLL_TRENDING_MS } from "@/constants/polling";
import type { TrendingCollection } from "@/types/collection";

export type { TrendingCollection };

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

// ─── GraphQL response types ───

type GqlCollectionStats = {
  id: string;
  totalVolume: string;
  totalSales: string;
  floorPrice: string | null;
  volume24h: string;
  sales24h: string;
  collection: {
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
  };
};

type GqlCollectionStatsData = {
  collectionStatses: GqlCollectionStats[];
};

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

/**
 * Fetches trending collections ranked by 24h volume.
 *
 * Previous implementation scanned up to 1200 entities (activityEvents +
 * listings + offers) and aggregated on the client. Now the subgraph
 * maintains `CollectionStats.volume24h` with day-based resets and we
 * query a single pre-sorted entity list.
 */
export function useTrendingCollections(limit = 10) {
  const [trending, setTrending] = useState<TrendingCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    data,
    loading: gqlLoading,
  } = useQuery<GqlCollectionStatsData>(GET_COLLECTION_STATS_RANKED, {
    skip: !SUBGRAPH_ENABLED,
    variables: { first: limit },
    pollInterval: POLL_TRENDING_MS,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  useEffect(() => {
    if (gqlLoading || !data?.collectionStatses) return;

    let cancelled = false;

    const build = async () => {
      setIsLoading(true);

      const mapped: TrendingCollection[] = data.collectionStatses.map((s) => {
        const vol24hWei = BigInt(s.volume24h ?? "0");
        const floorWei = s.floorPrice ? BigInt(s.floorPrice) : null;

        return {
          contractAddress: s.collection.contractAddress,
          name: s.collection.name,
          symbol: s.collection.symbol ?? "",
          image: s.collection.image ?? "",
          floorPrice: floorWei
            ? parseFloat(formatEther(floorWei)).toFixed(4)
            : null,
          floorChange24h: null,
          topOffer: null,
          sales24h: Number(s.sales24h ?? 0),
          owners: 0,
          listedPct: null,
          volume24h: parseFloat(formatEther(vol24hWei)).toFixed(4),
          floorHistory: [],
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
  }, [data, gqlLoading]);

  return { trending, isLoading: gqlLoading || isLoading };
}
