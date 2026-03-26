"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, http, formatEther, parseAbiItem, fallback } from "viem";
import { sepolia } from "viem/chains";
import { useQuery } from "@apollo/client/react";
import { useCollections } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { GET_TRENDING_DATA } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;

const rpcClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http("https://rpc.ankr.com/eth_sepolia"),
    http("https://ethereum-sepolia-rpc.publicnode.com"),
    http("https://rpc2.sepolia.org"),
    http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
  ]),
});

const ITEM_SOLD_ABI = parseAbiItem(
  "event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price)",
);
const ITEM_LISTED_ABI = parseAbiItem(
  "event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price)",
);
const OFFER_MADE_ABI = parseAbiItem(
  "event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt)",
);

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface TrendingCollection {
  contractAddress: string;
  name: string;
  symbol: string;
  image: string;
  floorPrice: string | null;
  floorChange24h: number | null;
  topOffer: string | null;
  sales24h: number;
  owners: number;
  listedPct: string | null;
  volume24h: string;
  floorHistory: number[];
}

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

type GqlSaleEvent = { nftContract: string; price: string; timestamp: string };
type GqlListing = { nftContract: string; price: string };
type GqlOffer = { nftContract: string; amount: string };
type GqlTrendingData = {
  activityEvents: GqlSaleEvent[];
  listings: GqlListing[];
  offers: GqlOffer[];
};

export function useTrendingCollections(limit = 10) {
  const [trending, setTrending] = useState<TrendingCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── GraphQL path ──
  const queryVars = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return {
      sevenDaysAgo: (now - 7 * 86400).toString(),
      now: now.toString(),
    };
  }, []);

  const {
    data: statsData,
    loading: statsLoading,
    error: statsError,
  } = useQuery<GqlTrendingData>(GET_TRENDING_DATA, {
    skip: !SUBGRAPH_ENABLED,
    variables: queryVars,
  });

  // ── RPC path ──
  const { collections } = useCollections();

  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;
    if (collections.length === 0) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const latestBlock = await rpcClient.getBlockNumber();
        // ~24h at 12s/block, within 10k block limit for all providers
        const fromBlock24h = latestBlock - BigInt(7200);

        // Sequential to avoid burst rate limiting on free-tier RPCs
        const logParams = { address: MARKETPLACE_ADDRESS, fromBlock: fromBlock24h, toBlock: "latest" as const };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let soldLogs: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let listedLogs24h: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let offerLogs: any[] = [];
        try {
          soldLogs = await rpcClient.getLogs({ ...logParams, event: ITEM_SOLD_ABI });
          listedLogs24h = await rpcClient.getLogs({ ...logParams, event: ITEM_LISTED_ABI });
          offerLogs = await rpcClient.getLogs({ ...logParams, event: OFFER_MADE_ABI });
        } catch (e) {
          console.warn("getLogs parcial falhou, usando arrays vazios:", e);
        }

        const results: TrendingCollection[] = await Promise.all(
          collections.map(async (col) => {
            const addr = col.contractAddress.toLowerCase();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sales = soldLogs.filter((l: any) =>
              (l.args as { nftContract: string }).nftContract?.toLowerCase() === addr,
            );
            const sales24h = sales.length;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const volume24hWei = sales.reduce((acc: bigint, l: any) =>
              acc + ((l.args as { price: bigint }).price ?? BigInt(0)),
              BigInt(0),
            );
            const volume24h = parseFloat(formatEther(volume24hWei)).toFixed(4);

            const floorHistory = sales
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((l: any) =>
                parseFloat(formatEther((l.args as { price: bigint }).price ?? BigInt(0))),
              )
              .slice(-8);

            let floorChange24h: number | null = null;
            if (floorHistory.length >= 2) {
              const first = floorHistory[0];
              const last = floorHistory[floorHistory.length - 1];
              if (first > 0) floorChange24h = ((last - first) / first) * 100;
            }

            // Floor price: check active listings from 24h window via contract
            let floorPrice: string | null = null;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const colListings = listedLogs24h.filter((l: any) =>
                (l.args as { nftContract: string }).nftContract?.toLowerCase() === addr,
              );
              const prices: bigint[] = [];
              await Promise.all(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                colListings.map(async (log: any) => {
                  const { tokenId } = log.args as { tokenId: bigint };
                  try {
                    const listing = (await rpcClient.readContract({
                      address: MARKETPLACE_ADDRESS,
                      abi: NFT_MARKETPLACE_ABI,
                      functionName: "getListing",
                      args: [col.contractAddress as `0x${string}`, tokenId],
                    })) as { active: boolean; price: bigint };
                    if (listing.active) prices.push(listing.price);
                  } catch { /* ignora */ }
                }),
              );
              if (prices.length > 0) {
                const min = prices.reduce((a, b) => (a < b ? a : b));
                floorPrice = parseFloat(formatEther(min)).toFixed(4);
              }
            } catch { /* ignora */ }

            let topOffer: string | null = null;
            const offersSorted = offerLogs
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((l: any) =>
                (l.args as { nftContract: string }).nftContract?.toLowerCase() === addr,
              )
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((l: any) => (l.args as { amount: bigint }).amount ?? BigInt(0))
              .sort((a: bigint, b: bigint) => (b > a ? 1 : -1));
            if (offersSorted.length > 0) {
              topOffer = parseFloat(formatEther(offersSorted[0])).toFixed(4);
            }

            // ── Owners ──────────────────────────────────────────────
            let owners = 0;
            try {
              const res = await globalThis.fetch(
                `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getOwnersForContract?contractAddress=${col.contractAddress}`,
              );
              const data = await res.json();
              owners = data.owners?.length ?? 0;
            } catch { /* ignora */ }

            // ── Listed % (active listings / total supply) ───────────
            let listedPct: string | null = null;
            try {
              const totalSupply = (await rpcClient.readContract({
                address: col.contractAddress as `0x${string}`,
                abi: NFT_COLLECTION_ABI,
                functionName: "totalSupply",
              })) as bigint;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const listedCount = listedLogs24h.filter((l: any) =>
                (l.args as { nftContract: string }).nftContract?.toLowerCase() === addr,
              ).length;

              if (totalSupply > BigInt(0)) {
                listedPct = ((listedCount / Number(totalSupply)) * 100).toFixed(1) + "%";
              }
            } catch { /* ignora */ }

            return {
              contractAddress: col.contractAddress,
              name: col.name,
              symbol: col.symbol,
              image: col.image,
              floorPrice,
              floorChange24h,
              topOffer,
              sales24h,
              owners,
              listedPct,
              volume24h,
              floorHistory,
            };
          }),
        );

        const sorted = results
          .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
          .slice(0, limit);

        setTrending(sorted);
      } catch (error) {
        console.error("Erro ao buscar trending:", error);
        // Fallback: show collections with basic info even if data fetch failed
        setTrending(
          collections.slice(0, limit).map((col) => ({
            contractAddress: col.contractAddress,
            name: col.name,
            symbol: col.symbol,
            image: col.image,
            floorPrice: null,
            floorChange24h: null,
            topOffer: null,
            sales24h: 0,
            owners: 0,
            listedPct: null,
            volume24h: "0.0000",
            floorHistory: [],
          })),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections.length, limit]);

  // ── Subgraph path: compute all stats from activityEvents + listings + offers ──
  useEffect(() => {
    if (!SUBGRAPH_ENABLED) return;
    if (statsLoading) return;
    if (collections.length === 0) return;

    // addr → { count, volumeWei, prices (sorted by timestamp asc) }
    type SaleAgg = { count: number; volumeWei: bigint; prices: number[] };
    const salesByAddr = new Map<string, SaleAgg>();
    const floorByAddr = new Map<string, string>();
    const topOfferByAddr = new Map<string, string>();

    if (!statsError && statsData) {
      // Events span 7 days — filter in JS for 24h stats, use full set for sparkline
      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
      for (const ev of statsData.activityEvents) {
        const addr = ev.nftContract.toLowerCase();
        const priceWei = BigInt(ev.price ?? "0");
        const priceEth = parseFloat(formatEther(priceWei));
        const agg = salesByAddr.get(addr) ?? { count: 0, volumeWei: BigInt(0), prices: [] };
        // prices array uses all 7-day events (for sparkline history)
        agg.prices.push(priceEth);
        // count & volume only accumulate events within last 24h
        if (Number(ev.timestamp) > oneDayAgo) {
          agg.count += 1;
          agg.volumeWei += priceWei;
        }
        salesByAddr.set(addr, agg);
      }

      // Floor price: minimum active listing per collection
      for (const listing of statsData.listings) {
        const addr = listing.nftContract.toLowerCase();
        const priceEth = parseFloat(formatEther(BigInt(listing.price)));
        const current = floorByAddr.get(addr);
        if (!current || priceEth < parseFloat(current)) {
          floorByAddr.set(addr, priceEth.toFixed(4));
        }
      }

      // Top offer: highest non-expired active offer per collection (query already desc)
      for (const offer of statsData.offers) {
        const addr = offer.nftContract.toLowerCase();
        if (!topOfferByAddr.has(addr)) {
          topOfferByAddr.set(
            addr,
            parseFloat(formatEther(BigInt(offer.amount))).toFixed(4),
          );
        }
      }
    }

    const fetchOwners = async () => {
      const ownerCounts = await Promise.all(
        collections.map(async (col) => {
          try {
            const res = await globalThis.fetch(
              `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getOwnersForContract?contractAddress=${col.contractAddress}`,
            );
            const data = await res.json();
            return data.owners?.length ?? 0;
          } catch {
            return 0;
          }
        }),
      );

      const mapped: TrendingCollection[] = collections
        .map((col, i) => {
          const addr = col.contractAddress.toLowerCase();
          const agg = salesByAddr.get(addr);

          const floorPrice = floorByAddr.get(addr) ?? null;
          const topOffer = topOfferByAddr.get(addr) ?? null;
          const sales24h = agg?.count ?? 0;
          const volume24h = agg
            ? parseFloat(formatEther(agg.volumeWei)).toFixed(4)
            : "0.0000";

          // Floor change: first vs last sale price in 24h window
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsData, statsLoading, statsError, collections.length, limit]);

  if (SUBGRAPH_ENABLED) {
    return { trending, isLoading: statsLoading || isLoading };
  }

  return { trending, isLoading };
}
