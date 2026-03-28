import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { GET_ALL_NFTS, GET_NFTS_FOR_CONTRACT } from "@/lib/graphql/queries";
import type { NFTItem, NFTItemWithMarket } from "@/types/nft";
import { resolveIpfsUrl } from "@/lib/ipfs";

export type { NFTItem, NFTItemWithMarket };

// ─── GraphQL types ───

type GqlListing = {
  id: string;
  price: string;
  active: boolean;
  seller: string;
};
type GqlOffer = {
  id: string;
  amount: string;
  buyer: string;
  expiresAt?: string;
};
type GqlNFT = {
  id: string;
  tokenId: string;
  tokenUri?: string;
  owner: string;
  collection?: {
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
  };
  listing?: GqlListing | null;
  offers?: GqlOffer[];
};
type GqlNFTsData = { nfts: GqlNFT[] };

// ─── Helpers ───


async function fetchAlchemyMetadata(
  contractAddress: string,
): Promise<Map<string, { name: string; description: string; image: string }>> {
  const map = new Map<
    string,
    { name: string; description: string; image: string }
  >();
  try {
    const res = await fetch(
      `/api/alchemy/getNFTsForContract?contractAddress=${contractAddress}&withMetadata=true&refreshCache=false`,
    );
    const data = await res.json();
    for (const nft of data.nfts ?? []) {
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
      map.set(nft.tokenId, {
        name: nft.name ?? `NFT #${nft.tokenId}`,
        description: nft.description ?? "",
        image,
      });
    }
  } catch {
    /* ignora */
  }
  return map;
}

async function mergeWithAlchemy(
  nfts: GqlNFT[],
  collectionAddress?: string,
): Promise<NFTItemWithMarket[]> {
  const byContract = new Map<string, GqlNFT[]>();
  for (const nft of nfts) {
    const addr = (
      nft.collection?.contractAddress ??
      collectionAddress ??
      ""
    ).toLowerCase();
    if (!byContract.has(addr)) byContract.set(addr, []);
    byContract.get(addr)!.push(nft);
  }

  const metaMaps = await Promise.all(
    [...byContract.keys()].map(async (addr) => ({
      addr,
      meta: await fetchAlchemyMetadata(addr),
    })),
  );
  const metaByContract = new Map(
    metaMaps.map(({ addr, meta }) => [addr, meta]),
  );

  return nfts.map((nft) => {
    const addr = (
      nft.collection?.contractAddress ??
      collectionAddress ??
      ""
    ).toLowerCase();
    const meta = metaByContract.get(addr)?.get(nft.tokenId);
    const activeListing = nft.listing?.active ? nft.listing : null;
    const topOfferRaw = nft.offers?.[0]?.amount;

    return {
      tokenId: nft.tokenId,
      name: meta?.name ?? `NFT #${nft.tokenId}`,
      description: meta?.description ?? "",
      image: meta?.image ?? "",
      nftContract: nft.collection?.contractAddress ?? collectionAddress ?? "",
      listingPrice: activeListing
        ? formatEther(BigInt(activeListing.price))
        : null,
      topOffer: topOfferRaw ? formatEther(BigInt(topOfferRaw)) : null,
      collectionName: nft.collection?.name ?? "",
      seller: activeListing?.seller ?? null,
    } as NFTItemWithMarket;
  });
}

// ─────────────────────────────────────────────
// useExploreNFTs — busca NFTs de uma coleção específica
// ─────────────────────────────────────────────

export function useExploreNFTs(
  collectionAddress?: string,
  page: number = 1,
  pageSize: number = 20,
) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const skip = (page - 1) * pageSize;

  const {
    data: gqlData,
    loading: gqlQueryLoading,
    refetch: refetchGql,
  } = useQuery<GqlNFTsData>(GET_NFTS_FOR_CONTRACT, {
    skip: !collectionAddress,
    variables: { collection: collectionAddress?.toLowerCase(), first: pageSize, skip },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  useEffect(() => {
    if (!collectionAddress || gqlQueryLoading) return;
    let cancelled = false;
    const run = async () => {
      const raw = gqlData?.nfts ?? [];
      if (raw.length === 0) {
        if (!cancelled) {
          setNfts([]);
          setIsLoading(false);
          setHasMore(false);
        }
        return;
      }
      if (!cancelled) {
        setIsLoading(true);
        setHasMore(raw.length === pageSize);
      }
      const items = await mergeWithAlchemy(raw, collectionAddress);
      if (!cancelled) {
        setNfts(items);
        setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [gqlData, gqlQueryLoading, collectionAddress, pageSize]);

  const refetch = useCallback(() => refetchGql(), [refetchGql]);

  return { nfts, isLoading, hasMore, refetch };
}

// ─────────────────────────────────────────────
// useExploreAllNFTs — busca NFTs de todas as coleções
// ─────────────────────────────────────────────

export function useExploreAllNFTs(
  collectionAddress?: string,
  page: number = 1,
  pageSize: number = 20,
) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const skip = (page - 1) * pageSize;

  const {
    data: gqlAllData,
    loading: gqlAllLoading,
    refetch: refetchAllNfts,
  } = useQuery<GqlNFTsData>(GET_ALL_NFTS, {
    skip: !!collectionAddress,
    variables: { first: pageSize + 1, skip },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: gqlColData,
    loading: gqlColLoading,
    refetch: refetchColNfts,
  } = useQuery<GqlNFTsData>(GET_NFTS_FOR_CONTRACT, {
    skip: !collectionAddress,
    variables: {
      collection: collectionAddress?.toLowerCase(),
      first: pageSize + 1,
      skip,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loading = collectionAddress ? gqlColLoading : gqlAllLoading;
      if (loading) {
        if (!cancelled) setIsLoading(true);
        return;
      }
      const rawAll = collectionAddress
        ? (gqlColData?.nfts ?? [])
        : (gqlAllData?.nfts ?? []);
      const hasNextPage = rawAll.length > pageSize;
      const raw = hasNextPage ? rawAll.slice(0, pageSize) : rawAll;
      if (raw.length === 0) {
        if (!cancelled) {
          setNfts([]);
          setIsLoading(false);
          setHasMore(false);
        }
        return;
      }
      if (!cancelled) {
        setIsLoading(true);
        setHasMore(hasNextPage);
      }
      const items = await mergeWithAlchemy(raw, collectionAddress);
      if (!cancelled) {
        setNfts(items);
        setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [gqlAllData, gqlColData, gqlAllLoading, gqlColLoading, collectionAddress, pageSize]);

  const refetch = useCallback(async () => {
    await Promise.all([refetchAllNfts(), refetchColNfts()]);
  }, [refetchAllNfts, refetchColNfts]);

  return { nfts, isLoading, hasMore, refetch };
}
