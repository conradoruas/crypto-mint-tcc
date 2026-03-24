"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";
import { useQuery } from "@apollo/client/react";
import { useCollections } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { GET_TRENDING_COLLECTIONS } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

const infuraClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
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

type GqlCollectionStats = {
  totalVolume?: string;
  volume24h?: string;
  totalSales?: string;
  sales24h?: string;
  floorPrice?: string;
  lastSaleTimestamp?: string;
};
type GqlTrendingCollection = {
  contractAddress: string;
  name: string;
  symbol: string;
  image?: string;
  mintPrice?: string;
  maxSupply?: string;
  totalSupply?: string;
  stats?: GqlCollectionStats;
};
type GqlTrendingData = { collections: GqlTrendingCollection[] };

export function useTrendingCollections(limit = 10) {
  const [trending, setTrending] = useState<TrendingCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── GraphQL path ──
  const { data: gqlData, loading: gqlLoading } = useQuery<GqlTrendingData>(
    GET_TRENDING_COLLECTIONS,
    { skip: !SUBGRAPH_ENABLED },
  );

  // ── RPC path ──
  const { collections } = useCollections();

  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;
    if (collections.length === 0) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const latestBlock = await infuraClient.getBlockNumber();
        const fromBlock24h = latestBlock - BigInt(7200);
        const fromBlock7d = latestBlock - BigInt(50400);

        const soldLogs = await infuraClient.getLogs({
          address: MARKETPLACE_ADDRESS,
          event: ITEM_SOLD_ABI,
          fromBlock: fromBlock24h,
          toBlock: "latest",
        });
        const listedLogs24h = await infuraClient.getLogs({
          address: MARKETPLACE_ADDRESS,
          event: ITEM_LISTED_ABI,
          fromBlock: fromBlock24h,
          toBlock: "latest",
        });
        const offerLogs = await infuraClient.getLogs({
          address: MARKETPLACE_ADDRESS,
          event: OFFER_MADE_ABI,
          fromBlock: fromBlock24h,
          toBlock: "latest",
        });
        const listedLogs7d = await infuraClient.getLogs({
          address: MARKETPLACE_ADDRESS,
          event: ITEM_LISTED_ABI,
          fromBlock: fromBlock7d,
          toBlock: "latest",
        });

        const results: TrendingCollection[] = await Promise.all(
          collections.map(async (col) => {
            const addr = col.contractAddress.toLowerCase();

            const sales = soldLogs.filter(
              (l) =>
                (l.args as { nftContract: string }).nftContract?.toLowerCase() ===
                addr,
            );
            const sales24h = sales.length;

            const volume24hWei = sales.reduce(
              (acc, l) =>
                acc + ((l.args as { price: bigint }).price ?? BigInt(0)),
              BigInt(0),
            );
            const volume24h = parseFloat(formatEther(volume24hWei)).toFixed(4);

            const floorHistory = sales
              .map((l) =>
                parseFloat(
                  formatEther(
                    (l.args as { price: bigint }).price ?? BigInt(0),
                  ),
                ),
              )
              .slice(-8);

            let floorPrice: string | null = null;
            try {
              const colListings = listedLogs7d.filter(
                (l) =>
                  (
                    l.args as { nftContract: string }
                  ).nftContract?.toLowerCase() === addr,
              );

              const prices: bigint[] = [];
              await Promise.all(
                colListings.map(async (log) => {
                  const { tokenId } = log.args as { tokenId: bigint };
                  try {
                    const listing = (await publicClient.readContract({
                      address: MARKETPLACE_ADDRESS,
                      abi: NFT_MARKETPLACE_ABI,
                      functionName: "getListing",
                      args: [col.contractAddress as `0x${string}`, tokenId],
                    })) as { active: boolean; price: bigint };
                    if (listing.active) prices.push(listing.price);
                  } catch {
                    /* ignora */
                  }
                }),
              );

              if (prices.length > 0) {
                const min = prices.reduce((a, b) => (a < b ? a : b));
                floorPrice = parseFloat(formatEther(min)).toFixed(4);
              }
            } catch {
              /* ignora */
            }

            let floorChange24h: number | null = null;
            if (floorHistory.length >= 2) {
              const first = floorHistory[0];
              const last = floorHistory[floorHistory.length - 1];
              if (first > 0) floorChange24h = ((last - first) / first) * 100;
            }

            let topOffer: string | null = null;
            const offersSorted = offerLogs
              .filter(
                (l) =>
                  (
                    l.args as { nftContract: string }
                  ).nftContract?.toLowerCase() === addr,
              )
              .map((l) => (l.args as { amount: bigint }).amount ?? BigInt(0))
              .sort((a, b) => (b > a ? 1 : -1));
            if (offersSorted.length > 0) {
              topOffer = parseFloat(formatEther(offersSorted[0])).toFixed(4);
            }

            let owners = 0;
            try {
              const res = await globalThis.fetch(
                `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getOwnersForContract?contractAddress=${col.contractAddress}`,
              );
              const data = await res.json();
              owners = data.owners?.length ?? 0;
            } catch {
              /* ignora */
            }

            let listedPct: string | null = null;
            try {
              const totalSupply = (await publicClient.readContract({
                address: col.contractAddress as `0x${string}`,
                abi: NFT_COLLECTION_ABI,
                functionName: "totalSupply",
              })) as bigint;

              const listedCount = listedLogs24h.filter(
                (l) =>
                  (
                    l.args as { nftContract: string }
                  ).nftContract?.toLowerCase() === addr,
              ).length;

              if (totalSupply > BigInt(0)) {
                listedPct =
                  ((listedCount / Number(totalSupply)) * 100).toFixed(1) + "%";
              }
            } catch {
              /* ignora */
            }

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
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections.length, limit]);

  if (SUBGRAPH_ENABLED) {
    const cols = gqlData?.collections ?? [];
    const mapped: TrendingCollection[] = cols
      .map((c) => {
        const stats = c.stats;
        const floorRaw = stats?.floorPrice;
        const floorPrice = floorRaw
          ? parseFloat(formatEther(BigInt(floorRaw))).toFixed(4)
          : null;
        const vol24hRaw = stats?.volume24h ?? "0";
        const volume24h = parseFloat(formatEther(BigInt(vol24hRaw))).toFixed(4);
        const topOfferRaw = null; // not indexed per-collection in subgraph
        const sales24h = Number(stats?.sales24h ?? 0);
        const listedPct = null; // not tracked at collection level

        return {
          contractAddress: c.contractAddress,
          name: c.name,
          symbol: c.symbol,
          image: c.image ?? "",
          floorPrice,
          floorChange24h: null,
          topOffer: topOfferRaw,
          sales24h,
          owners: 0,
          listedPct,
          volume24h,
          floorHistory: [],
        } as TrendingCollection;
      })
      .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
      .slice(0, limit);

    return { trending: mapped, isLoading: gqlLoading };
  }

  return { trending, isLoading };
}
