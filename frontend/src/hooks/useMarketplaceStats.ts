"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { useQuery } from "@apollo/client/react";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { GET_MARKETPLACE_STATS } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const FACTORY_ADDRESS = process.env
  .NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS as `0x${string}`;

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("/api/rpc"),
});

export interface MarketplaceStats {
  totalCollections: number;
  totalNFTs: number;
  totalListed: number;
  volumeETH: string;
  isLoading: boolean;
}

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
  // ── GraphQL path ──
  const { data: gqlData, loading: gqlLoading } = useQuery<GqlStatsData>(
    GET_MARKETPLACE_STATS,
    { skip: !SUBGRAPH_ENABLED },
  );

  // ── RPC path ──
  const [rpcStats, setRpcStats] = useState<MarketplaceStats>({
    totalCollections: 0,
    totalNFTs: 0,
    totalListed: 0,
    volumeETH: "0",
    isLoading: true,
  });

  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;

    const fetch = async () => {
      try {
        const collections = (await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: NFT_COLLECTION_FACTORY_ABI,
          functionName: "getAllCollections",
        })) as unknown as {
          contractAddress: `0x${string}`;
          mintPrice: bigint;
        }[];

        const totalCollections = collections.length;

        const supplies = await Promise.all(
          collections.map(async (c) => {
            try {
              const supply = (await publicClient.readContract({
                address: c.contractAddress,
                abi: NFT_COLLECTION_ABI,
                functionName: "totalSupply",
              })) as bigint;
              return Number(supply);
            } catch {
              return 0;
            }
          }),
        );
        const totalNFTs = supplies.reduce((a, b) => a + b, 0);

        let totalListed = 0;
        for (const c of collections) {
          try {
            const res = await globalThis.fetch(
              `/api/alchemy/getNFTsForContract?contractAddress=${c.contractAddress}&withMetadata=false`,
            );
            const data = await res.json();
            const nfts = data.nfts ?? [];

            const listingChecks = await Promise.all(
              nfts.map(async (nft: { tokenId: string }) => {
                try {
                  const listing = (await publicClient.readContract({
                    address: MARKETPLACE_ADDRESS,
                    abi: NFT_MARKETPLACE_ABI,
                    functionName: "getListing",
                    args: [c.contractAddress, BigInt(nft.tokenId)],
                  })) as { active: boolean };
                  return listing.active ? 1 : 0;
                } catch {
                  return 0;
                }
              }),
            );
            totalListed += listingChecks.reduce(
              (a: number, b: number) => a + b,
              0,
            );
          } catch {
            /* continua */
          }
        }

        const balance = await publicClient.getBalance({
          address: MARKETPLACE_ADDRESS,
        });
        const volumeETH = parseFloat(formatEther(balance)).toFixed(4);

        setRpcStats({
          totalCollections,
          totalNFTs,
          totalListed,
          volumeETH,
          isLoading: false,
        });
      } catch (error) {
        console.error("Erro ao buscar stats:", error);
        setRpcStats((s) => ({ ...s, isLoading: false }));
      }
    };

    if (FACTORY_ADDRESS && MARKETPLACE_ADDRESS) fetch();
    else setRpcStats((s) => ({ ...s, isLoading: false }));
  }, []);

  if (SUBGRAPH_ENABLED) {
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

  return rpcStats;
}
