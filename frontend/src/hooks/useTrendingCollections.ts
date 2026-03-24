"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";
import { useCollections } from "@/hooks/useCollections";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;

// Alchemy: readContract, owners API
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

// Infura: getLogs (suporta ranges maiores que Alchemy free tier)
const infuraClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
});

// ─── Eventos ───
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

export function useTrendingCollections(limit = 10) {
  const [trending, setTrending] = useState<TrendingCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { collections } = useCollections();

  useEffect(() => {
    if (collections.length === 0) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const latestBlock = await infuraClient.getBlockNumber();
        const fromBlock24h = latestBlock - BigInt(7200); // ~24h
        const fromBlock7d = latestBlock - BigInt(50400); // ~7 dias

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

            // ─── Vendas 24h ───
            const sales = soldLogs.filter(
              (l) =>
                (
                  l.args as { nftContract: string }
                ).nftContract?.toLowerCase() === addr,
            );
            const sales24h = sales.length;

            // ─── Volume 24h ───
            const volume24hWei = sales.reduce(
              (acc, l) =>
                acc + ((l.args as { price: bigint }).price ?? BigInt(0)),
              BigInt(0),
            );
            const volume24h = parseFloat(formatEther(volume24hWei)).toFixed(4);

            // ─── Sparkline (últimas vendas) ───
            const floorHistory = sales
              .map((l) =>
                parseFloat(
                  formatEther((l.args as { price: bigint }).price ?? BigInt(0)),
                ),
              )
              .slice(-8);

            // ─── Floor price atual (menor listagem ativa — readContract via Alchemy) ───
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

            // ─── Variação do floor 24h ───
            let floorChange24h: number | null = null;
            if (floorHistory.length >= 2) {
              const first = floorHistory[0];
              const last = floorHistory[floorHistory.length - 1];
              if (first > 0) floorChange24h = ((last - first) / first) * 100;
            }

            // ─── Top offer ───
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

            // ─── Owners únicos via Alchemy ───
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

            // ─── % listado ───
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
  }, [collections.length, limit]);

  return { trending, isLoading };
}
