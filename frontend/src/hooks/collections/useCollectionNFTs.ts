"use client";
import { SUBGRAPH_ENABLED } from "@/lib/env";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionNFTItem } from "@/types/nft";
import { fetchIpfsJson, resolveIpfsUrl } from "@/lib/ipfs";
import { logger } from "@/lib/logger";
import type { AlchemyNFT } from "@/types/alchemy";
import { apolloClient } from "@/lib/apolloClient";
import { GET_COLLECTION_WITH_NFTS } from "@/lib/graphql/queries";

const PAGE_SIZE = 20;

// ─── IPFS metadata resolution ───

type IpfsMeta = { name: string; description: string; image: string };

async function resolveTokenMeta(tokenUri: string): Promise<IpfsMeta | null> {
  const json = await fetchIpfsJson<{ name?: string; description?: string; image?: string }>(tokenUri);
  if (!json) return null;
  return {
    name: json.name ?? "",
    description: json.description ?? "",
    image: resolveIpfsUrl(json.image ?? ""),
  };
}

// ─── Subgraph fetch ───

type GqlNFT = { tokenId: string; tokenUri?: string };

async function fetchSubgraphPage(
  collectionAddress: string,
  skip: number,
): Promise<{ items: CollectionNFTItem[]; totalCount: number; hasMore: boolean }> {
  const { data } = await apolloClient.query<{
    collection: { totalSupply: string } | null;
    nfts: GqlNFT[];
  }>({
    query: GET_COLLECTION_WITH_NFTS,
    variables: {
      id: collectionAddress.toLowerCase(),
      first: PAGE_SIZE + 1,
      skip,
    },
    fetchPolicy: "network-only",
  });

  type RawNft = { tokenId: string; tokenUri?: string | null };
  const rawNfts: RawNft[] = data?.nfts ?? [];
  const hasMore = rawNfts.length > PAGE_SIZE;
  const nfts = hasMore ? rawNfts.slice(0, PAGE_SIZE) : rawNfts;
  const totalCount = Number(data?.collection?.totalSupply ?? 0);

  const metaResults = await Promise.all(
    nfts.map((nft) => resolveTokenMeta(nft.tokenUri ?? "")),
  );

  const items: CollectionNFTItem[] = nfts.map((nft, i) => {
    const meta = metaResults[i];
    return {
      tokenId: nft.tokenId,
      name: meta?.name || `NFT #${nft.tokenId}`,
      description: meta?.description ?? "",
      image: meta?.image ?? "",
      nftContract: collectionAddress,
    };
  });

  return { items, totalCount, hasMore };
}

// ─── Alchemy fetch ───

async function fetchAlchemyPage(
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
    pageSize: String(PAGE_SIZE),
  });
  if (pageKey) params.set("pageKey", pageKey);

  const res = await fetch(`/api/alchemy/getNFTsForContract?${params}`);
  const data = await res.json();

  const items: CollectionNFTItem[] = await Promise.all(
    (data.nfts ?? []).map(async (nft: AlchemyNFT) => {
      let image = nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "";
      if (!image && nft.tokenUri) {
        const meta = await fetchIpfsJson<{ image?: string }>(nft.tokenUri);
        image = resolveIpfsUrl(meta?.image ?? "");
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

// ─── Hook ───

export function useCollectionNFTs(collectionAddress: string | undefined) {
  const [nfts, setNfts] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [hasMore, setHasMore] = useState(false);

  // Pagination cursors
  const alchemyPageKey = useRef<string | undefined>(undefined);
  const subgraphSkip = useRef(0);

  // Initial load
  useEffect(() => {
    setNfts([]);
    setHasMore(false);
    alchemyPageKey.current = undefined;
    subgraphSkip.current = 0;

    if (!collectionAddress) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      try {
        if (SUBGRAPH_ENABLED) {
          const { items, totalCount, hasMore: more } =
            await fetchSubgraphPage(collectionAddress, 0);
          if (!cancelled) {
            setNfts(items);
            setTotalSupply(totalCount);
            setHasMore(more);
            subgraphSkip.current = items.length;
          }
        } else {
          const { items, nextPageKey, totalCount } =
            await fetchAlchemyPage(collectionAddress);
          if (!cancelled) {
            setNfts(items);
            setTotalSupply(totalCount);
            setHasMore(!!nextPageKey);
            alchemyPageKey.current = nextPageKey;
          }
        }
      } catch (error) {
        if (!cancelled) logger.error("Erro ao buscar NFTs da coleção", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [collectionAddress]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!collectionAddress || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      if (SUBGRAPH_ENABLED) {
        const { items, hasMore: more } =
          await fetchSubgraphPage(collectionAddress, subgraphSkip.current);
        setNfts((prev) => [...prev, ...items]);
        setHasMore(more);
        subgraphSkip.current += items.length;
      } else {
        const { items, nextPageKey } =
          await fetchAlchemyPage(collectionAddress, alchemyPageKey.current);
        setNfts((prev) => [...prev, ...items]);
        setHasMore(!!nextPageKey);
        alchemyPageKey.current = nextPageKey;
      }
    } catch (error) {
      logger.error("Erro ao buscar mais NFTs", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [collectionAddress, isLoadingMore, hasMore]);

  return { nfts, isLoading, isLoadingMore, totalSupply, hasMore, loadMore };
}
