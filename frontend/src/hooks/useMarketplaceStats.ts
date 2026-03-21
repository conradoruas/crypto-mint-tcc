"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";

const FACTORY_ADDRESS = process.env
  .NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS as `0x${string}`;

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

export interface MarketplaceStats {
  totalCollections: number;
  totalNFTs: number;
  totalListed: number;
  volumeETH: string; // ETH acumulado no marketplace (taxas)
  isLoading: boolean;
}

export function useMarketplaceStats(): MarketplaceStats {
  const [stats, setStats] = useState<MarketplaceStats>({
    totalCollections: 0,
    totalNFTs: 0,
    totalListed: 0,
    volumeETH: "0",
    isLoading: true,
  });

  useEffect(() => {
    const fetch = async () => {
      try {
        // 1. Busca todas as coleções
        const collections = (await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: NFT_COLLECTION_FACTORY_ABI,
          functionName: "getAllCollections",
        })) as unknown as {
          contractAddress: `0x${string}`;
          mintPrice: bigint;
        }[];

        const totalCollections = collections.length;

        // 2. Soma totalSupply de todas as coleções
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

        // 3. Conta NFTs listados via Alchemy NFT API
        // Busca listagens ativas somando por coleção
        let totalListed = 0;
        for (const c of collections) {
          try {
            const res = await globalThis.fetch(
              `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForContract?contractAddress=${c.contractAddress}&withMetadata=false`,
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

        // 4. Volume — saldo atual de taxas acumuladas no marketplace
        const balance = await publicClient.getBalance({
          address: MARKETPLACE_ADDRESS,
        });
        const volumeETH = parseFloat(formatEther(balance)).toFixed(4);

        setStats({
          totalCollections,
          totalNFTs,
          totalListed,
          volumeETH,
          isLoading: false,
        });
      } catch (error) {
        console.error("Erro ao buscar stats:", error);
        setStats((s) => ({ ...s, isLoading: false }));
      }
    };

    if (FACTORY_ADDRESS && MARKETPLACE_ADDRESS) fetch();
    else setStats((s) => ({ ...s, isLoading: false }));
  }, []);

  return stats;
}
