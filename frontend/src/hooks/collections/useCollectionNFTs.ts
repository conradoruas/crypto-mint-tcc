"use client";

import { useEffect, useState } from "react";
import type { CollectionNFTItem } from "@/types/nft";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { logger } from "@/lib/logger";

const PAGE_SIZE_COLLECTION = 20;

/**
 * Helper to fetch a paginated list of NFTs from a collection directly from Alchemy.
 */
async function fetchCollectionPage(
  collectionAddress: string,
  pageKey?: string,
): Promise<{
  items: CollectionNFTItem[];
  nextPageKey?: string;
  totalCount: number;
}> {
  const params = new URLSearchParams({
    contractAddress: collectionAddress,
    withMetadata: "true",
    refreshCache: "false",
    pageSize: String(PAGE_SIZE_COLLECTION),
  });
  if (pageKey) params.set("pageKey", pageKey);

  const res = await fetch(`/api/alchemy/getNFTsForContract?${params}`);
  const data = await res.json();

  const items: CollectionNFTItem[] = await Promise.all(
    (data.nfts ?? []).map(async (nft: any) => {
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
        nftContract: collectionAddress,
      };
    }),
  );

  return {
    items,
    nextPageKey: data.pageKey as string | undefined,
    totalCount: (data.totalCount as number | undefined) ?? items.length,
  };
}

/**
 * Hook to fetch paginated NFTs for a collection.
 */
export function useCollectionNFTs(collectionAddress: string | undefined) {
  const [nfts, setNfts] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [nextPageKey, setNextPageKey] = useState<string | undefined>(undefined);
  const hasMore = !!nextPageKey;

  useEffect(() => {
    setNfts([]);
    setNextPageKey(undefined);

    if (!collectionAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchCollectionPage(collectionAddress)
      .then(({ items, nextPageKey: key, totalCount }) => {
        setNfts(items);
        setNextPageKey(key);
        setTotalSupply(totalCount);
      })
      .catch((error) => logger.error("Erro ao buscar NFTs da coleção", error))
      .finally(() => setIsLoading(false));
  }, [collectionAddress]);

  const loadMore = async () => {
    if (!collectionAddress || !nextPageKey) return;
    setIsLoadingMore(true);
    try {
      const { items, nextPageKey: key } = await fetchCollectionPage(
        collectionAddress,
        nextPageKey,
      );
      setNfts((prev) => [...prev, ...items]);
      setNextPageKey(key);
    } catch (error) {
      logger.error("Erro ao buscar mais NFTs", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return { nfts, isLoading, isLoadingMore, totalSupply, hasMore, loadMore };
}
