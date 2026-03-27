"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { useCollections } from "@/hooks/useCollections";
import { GET_TRENDING_DATA } from "@/lib/graphql/queries";
import type { TrendingCollection } from "@/types/collection";

export type { TrendingCollection };

type GqlSaleEvent = { nftContract: string; price: string; timestamp: string };
type GqlListing = { nftContract: string; price: string };
type GqlOffer = { nftContract: string; amount: string };
type GqlTrendingData = {
  activityEvents: GqlSaleEvent[];
  listings: GqlListing[];
  offers: GqlOffer[];
};

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

export function useTrendingCollections(limit = 10) {
  const [trending, setTrending] = useState<TrendingCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const makeQueryVars = () => {
    const now = Math.floor(Date.now() / 1000);
    return { sevenDaysAgo: (now - 7 * 86400).toString(), now: now.toString() };
  };

  const {
    data: statsData,
    loading: statsLoading,
    error: statsError,
    refetch,
  } = useQuery<GqlTrendingData>(GET_TRENDING_DATA, {
    variables: makeQueryVars(),
    pollInterval: 5 * 60 * 1000,
  });

  // Atualiza os timestamps das variáveis a cada poll para manter a janela de 7 dias correta
  useEffect(() => {
    const id = setInterval(() => refetch(makeQueryVars()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refetch]);

  const { collections } = useCollections();

  const collectionsRef = useRef(collections);
  useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  const collectionKey = useMemo(
    () => collections.map((c) => c.contractAddress).join(","),
    [collections],
  );

  useEffect(() => {
    if (statsLoading) return;
    if (!collectionKey) return;

    type SaleAgg = { count: number; volumeWei: bigint; prices: number[] };
    const salesByAddr = new Map<string, SaleAgg>();
    const floorByAddr = new Map<string, string>();
    const topOfferByAddr = new Map<string, string>();

    if (!statsError && statsData) {
      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
      for (const ev of statsData.activityEvents ?? []) {
        const addr = (ev.nftContract ?? "").toLowerCase();
        if (!addr) continue;
        const priceWei = BigInt(ev.price ?? "0");
        const priceEth = parseFloat(formatEther(priceWei));
        const agg = salesByAddr.get(addr) ?? {
          count: 0,
          volumeWei: BigInt(0),
          prices: [],
        };

        agg.prices.push(priceEth);

        if (Number(ev.timestamp) > oneDayAgo) {
          agg.count += 1;
          agg.volumeWei += priceWei;
        }
        salesByAddr.set(addr, agg);
      }

      for (const listing of statsData.listings ?? []) {
        const addr = (listing.nftContract ?? "").toLowerCase();
        if (!addr || !listing.price) continue;
        const priceEth = parseFloat(formatEther(BigInt(listing.price)));
        const current = floorByAddr.get(addr);
        if (!current || priceEth < parseFloat(current)) {
          floorByAddr.set(addr, priceEth.toFixed(4));
        }
      }

      for (const offer of statsData.offers ?? []) {
        const addr = (offer.nftContract ?? "").toLowerCase();
        if (!addr || !offer.amount) continue;
        if (!topOfferByAddr.has(addr)) {
          topOfferByAddr.set(
            addr,
            parseFloat(formatEther(BigInt(offer.amount))).toFixed(4),
          );
        }
      }
    }

    const fetchOwners = async () => {
      const cols = collectionsRef.current;
      const ownerCounts = await Promise.all(
        cols.map(async (col) => {
          try {
            const res = await globalThis.fetch(
              `/api/alchemy/getOwnersForContract?contractAddress=${col.contractAddress}`,
            );
            const data = await res.json();
            return data.owners?.length ?? 0;
          } catch {
            return 0;
          }
        }),
      );

      const mapped: TrendingCollection[] = cols
        .map((col, i) => {
          const addr = col.contractAddress.toLowerCase();
          const agg = salesByAddr.get(addr);

          const floorPrice = floorByAddr.get(addr) ?? null;
          const topOffer = topOfferByAddr.get(addr) ?? null;
          const sales24h = agg?.count ?? 0;
          const volume24h = agg
            ? parseFloat(formatEther(agg.volumeWei)).toFixed(4)
            : "0.0000";

          const floorHistory = agg?.prices.slice(-8) ?? [];
          let floorChange24h: number | null = null;
          if (floorHistory.length >= 2) {
            const first = floorHistory[0];
            const last = floorHistory[floorHistory.length - 1];
            if (first > 0) floorChange24h = ((last - first) / first) * 100;
          }

          return {
            contractAddress: col.contractAddress,
            name: col.name,
            symbol: col.symbol,
            image: col.image ?? "",
            floorPrice,
            floorChange24h,
            topOffer,
            sales24h,
            owners: ownerCounts[i],
            listedPct: null,
            volume24h,
            floorHistory,
          } as TrendingCollection;
        })
        .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
        .slice(0, limit);

      setTrending(mapped);
      setIsLoading(false);
    };

    setIsLoading(true);
    fetchOwners();
  }, [statsData, statsLoading, statsError, collectionKey, limit]);

  return { trending, isLoading: statsLoading || isLoading };
}
