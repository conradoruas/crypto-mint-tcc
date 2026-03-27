import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { GET_ALL_NFTS, GET_NFTS_FOR_CONTRACT } from "@/lib/graphql/queries";
import type { NFTItem, NFTItemWithMarket } from "@/types/nft";

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

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

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

  const { data: gqlData, loading: gqlQueryLoading } = useQuery<GqlNFTsData>(
    GET_NFTS_FOR_CONTRACT,
    {
      skip: !collectionAddress,
      variables: { collection: collectionAddress?.toLowerCase(), first: pageSize, skip },
    },
  );

  useEffect(() => {
    if (!collectionAddress) return;
    if (gqlQueryLoading) return;
    const raw = gqlData?.nfts ?? [];
    if (raw.length === 0) {
      setNfts([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setHasMore(raw.length === pageSize);
    mergeWithAlchemy(raw, collectionAddress).then((items) => {
      if (cancelled) return;
      setNfts(items);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [gqlData, gqlQueryLoading, collectionAddress, pageSize]);

  return { nfts, isLoading, hasMore };
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

  const { data: gqlAllData, loading: gqlAllLoading } = useQuery<GqlNFTsData>(
    GET_ALL_NFTS,
    {
      skip: !!collectionAddress,
      variables: { first: pageSize + 1, skip },
    },
  );

  const { data: gqlColData, loading: gqlColLoading } = useQuery<GqlNFTsData>(
    GET_NFTS_FOR_CONTRACT,
    {
      skip: !collectionAddress,
      variables: { collection: collectionAddress?.toLowerCase(), first: pageSize + 1, skip },
    },
  );

  // Mirror Apollo's loading state immediately so the page never shows stale data.
  useEffect(() => {
    const loading = collectionAddress ? gqlColLoading : gqlAllLoading;
    if (loading) setIsLoading(true);
  }, [gqlAllLoading, gqlColLoading, collectionAddress]);

  useEffect(() => {
    const loading = collectionAddress ? gqlColLoading : gqlAllLoading;
    if (loading) return;
    const rawAll = collectionAddress
      ? (gqlColData?.nfts ?? [])
      : (gqlAllData?.nfts ?? []);

    const hasNextPage = rawAll.length > pageSize;
    const raw = hasNextPage ? rawAll.slice(0, pageSize) : rawAll;

    if (raw.length === 0) {
      setNfts([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setHasMore(hasNextPage);
    mergeWithAlchemy(raw, collectionAddress).then(
      (items: NFTItemWithMarket[]) => {
        if (cancelled) return;
        setNfts(items);
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [gqlAllData, gqlColData, gqlAllLoading, gqlColLoading, collectionAddress, pageSize]);

  return { nfts, isLoading, hasMore };
}
