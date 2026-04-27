"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCollections } from "./useCollections";
import { useCreatorCollections } from "./useCollections";
import { useStableArray } from "../useStableArray";
import { logger } from "@/lib/logger";
import { normalizeNftText, resolveNftImage } from "@/lib/nftMetadata";
import { getSafeImageUrl } from "@/lib/resourceSecurity";
import type { CollectionNFTItem, CreatedNFTItem } from "@/types/nft";
import type { AlchemyNFT } from "@/types/alchemy";
import type { NftAttribute } from "@/types/traits";

function normalizeAttributes(
  rawAttrs:
    | Array<{
        trait_type?: string;
        value?: string | number | boolean;
        display_type?: string;
      }>
    | undefined,
): NftAttribute[] | undefined {
  const attributes = rawAttrs?.flatMap((attr) =>
    attr.trait_type && attr.value != null
      ? [{
          trait_type: attr.trait_type,
          value: attr.value,
          display_type: attr.display_type,
        }]
      : [],
  );

  return attributes && attributes.length > 0 ? attributes : undefined;
}

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
          const image = await resolveNftImage(nft.image, nft.tokenUri, { signal });
          const attributes = normalizeAttributes(nft.raw?.metadata?.attributes);
          return {
            tokenId: nft.tokenId,
            name: normalizeNftText(nft.name, `NFT #${nft.tokenId}`, 500),
            description: normalizeNftText(nft.description, "", 10_000),
            image,
            nftContract: nft.contract?.address ?? collectionAddress ?? "",
            collectionName: normalizeNftText(nft.collection?.name, "", 200),
            attributes: attributes && attributes.length > 0 ? attributes : undefined,
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
          return (data.nfts ?? []).map((nft: AlchemyNFT) => {
            const attributes = normalizeAttributes(nft.raw?.metadata?.attributes);
            return {
              tokenId: nft.tokenId,
              name: normalizeNftText(nft.name, `NFT #${nft.tokenId}`, 500),
              description: normalizeNftText(nft.description, "", 10_000),
              image: getSafeImageUrl(nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "") ?? "",
              nftContract: col.contractAddress,
              collectionName: normalizeNftText(col.name, "", 200),
              attributes: attributes && attributes.length > 0 ? attributes : undefined,
            };
          }) satisfies CreatedNFTItem[];
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
