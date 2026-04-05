"use client";

import { useEffect, useState } from "react";
import { useCollections } from "./useCollections";
import { useCreatorCollections } from "./useCollections";
import { useStableArray } from "../useStableArray";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { logger } from "@/lib/logger";
import type { CollectionNFTItem, CreatedNFTItem } from "@/types/nft";
import type { AlchemyNFT } from "@/types/alchemy";

/**
 * Hook to fetch NFTs owned by a specific address from all known collections or a specific one.
 */
export function useProfileNFTs(
  ownerAddress: string | undefined,
  collectionAddress?: string,
) {
  const [nfts, setNfts] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { collections } = useCollections();

  useEffect(() => {
    if (!ownerAddress) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const contractList = collectionAddress
          ? [collectionAddress]
          : collections.map((c) => c.contractAddress);

        if (contractList.length === 0) {
          setNfts([]);
          setIsLoading(false);
          return;
        }

        const contractParams = contractList
          .map((addr) => `contractAddresses[]=${addr}`)
          .join("&");

        const res = await fetch(
          `/api/alchemy/getNFTsForOwner?owner=${ownerAddress}&${contractParams}&withMetadata=true`,
        );
        const data = await res.json();

        const items: CollectionNFTItem[] = await Promise.all(
          (data.ownedNfts ?? []).map(async (nft: AlchemyNFT) => {
            let image = nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "";
            if (!image && nft.tokenUri) {
              try {
                const metaRes = await fetch(resolveIpfsUrl(nft.tokenUri));
                const meta = await metaRes.json();
                image = resolveIpfsUrl(meta.image ?? "");
              } catch {
                image = "";
              }
            }
            return {
              tokenId: nft.tokenId,
              name: nft.name ?? `NFT #${nft.tokenId}`,
              description: nft.description ?? "",
              image,
              nftContract: nft.contract?.address ?? collectionAddress ?? "",
              collectionName: nft.collection?.name ?? "",
            };
          }),
        );

        setNfts(items);
      } catch (error) {
        logger.error("Erro ao buscar NFTs do perfil", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (collectionAddress || collections.length > 0) {
      load();
    } else {
      setIsLoading(false);
    }
  }, [ownerAddress, collectionAddress, collections]);

  return { nfts, isLoading };
}

/**
 * Hook to fetch all NFTs from collections created by the specific user.
 */
export function useCreatedNFTs(ownerAddress: string | undefined) {
  const [nfts, setNfts] = useState<CreatedNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { collections: creatorCollections, isLoading: isLoadingCollections } =
    useCreatorCollections();
  const stableCollections = useStableArray(
    creatorCollections,
    (col) => col.contractAddress,
  );

  useEffect(() => {
    if (!ownerAddress || isLoadingCollections) return;
    if (stableCollections.length === 0) {
      setNfts([]);
      setIsLoading(false);
      return;
    }

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          stableCollections.map(async (col) => {
            const res = await fetch(
              `/api/alchemy/getNFTsForContract?contractAddress=${col.contractAddress}&withMetadata=true&refreshCache=false`,
            );
            const data = await res.json();
            return (data.nfts ?? []).map((nft: AlchemyNFT) => ({
              tokenId: nft.tokenId,
              name: nft.name ?? `NFT #${nft.tokenId}`,
              description: nft.description ?? "",
              image: nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "",
              nftContract: col.contractAddress,
              collectionName: col.name,
            }));
          }),
        );
        setNfts(results.flat());
      } catch (error) {
        logger.error("Erro ao buscar NFTs criados", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [ownerAddress, isLoadingCollections, stableCollections]);

  return { nfts, isLoading };
}
