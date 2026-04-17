"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCollections } from "./useCollections";
import { useCreatorCollections } from "./useCollections";
import { useStableArray } from "../useStableArray";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { logger } from "@/lib/logger";
import type { CollectionNFTItem, CreatedNFTItem } from "@/types/nft";
import type { AlchemyNFT } from "@/types/alchemy";

export function useProfileNFTs(
  ownerAddress: string | undefined,
  collectionAddress?: string,
) {
  const { collections: rawCollections } = useCollections();
  const collections = useStableArray(rawCollections, (c) => c.contractAddress);

  const contractList = useMemo(
    () =>
      collectionAddress
        ? [collectionAddress]
        : collections.map((c) => c.contractAddress),
    [collectionAddress, collections],
  );

  const { data: nfts = [], isLoading } = useQuery<CollectionNFTItem[]>({
    queryKey: ["profile-nfts", ownerAddress, contractList],
    queryFn: async ({ signal }) => {
      if (!ownerAddress || contractList.length === 0) return [];
      const contractParams = contractList
        .map((addr) => `contractAddresses[]=${addr}`)
        .join("&");
      const res = await fetch(
        `/api/alchemy/getNFTsForOwner?owner=${ownerAddress}&${contractParams}&withMetadata=true`,
        { signal },
      );
      const data = await res.json();
      return Promise.all(
        (data.ownedNfts ?? []).map(async (nft: AlchemyNFT) => {
          let image = nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "";
          if (!image && nft.tokenUri) {
            try {
              const metaRes = await fetch(resolveIpfsUrl(nft.tokenUri), { signal });
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
          } satisfies CollectionNFTItem;
        }),
      );
    },
    enabled: !!ownerAddress && (!!collectionAddress || collections.length > 0),
    staleTime: 60_000,
    throwOnError: false,
    meta: { onError: (err: unknown) => logger.error("Error fetching profile NFTs", err) },
  });

  return { nfts, isLoading };
}

export function useCreatedNFTs(ownerAddress: string | undefined) {
  const { collections: creatorCollections, isLoading: isLoadingCollections } =
    useCreatorCollections();
  const stableCollections = useStableArray(
    creatorCollections,
    (col) => col.contractAddress,
  );

  const { data: nfts = [], isLoading: isQueryLoading } = useQuery<CreatedNFTItem[]>({
    queryKey: [
      "created-nfts",
      ownerAddress,
      stableCollections.map((c) => c.contractAddress),
    ],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        stableCollections.map(async (col) => {
          const res = await fetch(
            `/api/alchemy/getNFTsForContract?contractAddress=${col.contractAddress}&withMetadata=true&refreshCache=false`,
            { signal },
          );
          const data = await res.json();
          return (data.nfts ?? []).map((nft: AlchemyNFT) => ({
            tokenId: nft.tokenId,
            name: nft.name ?? `NFT #${nft.tokenId}`,
            description: nft.description ?? "",
            image: nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "",
            nftContract: col.contractAddress,
            collectionName: col.name,
          })) satisfies CreatedNFTItem[];
        }),
      );
      return results.flat();
    },
    enabled: !!ownerAddress && !isLoadingCollections && stableCollections.length > 0,
    staleTime: 60_000,
    throwOnError: false,
    meta: { onError: (err: unknown) => logger.error("Error fetching created NFTs", err) },
  });

  return { nfts, isLoading: isLoadingCollections || isQueryLoading };
}
