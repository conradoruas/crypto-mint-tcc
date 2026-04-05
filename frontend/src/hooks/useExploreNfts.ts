import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import {
  GET_ALL_NFTS,
  GET_NFTS_FOR_CONTRACT,
} from "@/lib/graphql/queries";
import { resolveIpfsUrl } from "@/lib/ipfs";
import type { NFTItemWithMarket } from "@/types/nft";

export type { NFTItemWithMarket };

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

// ─── IPFS metadata resolution (replaces Alchemy cascade) ───

type IpfsMeta = { name: string; description: string; image: string };

/** In-memory cache keyed by tokenUri — metadata is immutable once pinned. */
const ipfsMetaCache = new Map<string, IpfsMeta>();

async function resolveTokenMeta(tokenUri: string): Promise<IpfsMeta | null> {
  if (!tokenUri) return null;

  const cached = ipfsMetaCache.get(tokenUri);
  if (cached) return cached;

  try {
    const res = await fetch(resolveIpfsUrl(tokenUri));
    const json = await res.json();
    const meta: IpfsMeta = {
      name: json.name ?? "",
      description: json.description ?? "",
      image: resolveIpfsUrl(json.image ?? ""),
    };
    ipfsMetaCache.set(tokenUri, meta);
    return meta;
  } catch {
    return null;
  }
}

/**
 * Resolve metadata for a batch of NFTs directly from their tokenUri (IPFS).
 *
 * Previously this called the Alchemy `/getNFTsForContract` endpoint per
 * contract, creating a waterfall: GraphQL → Alchemy HTTP → merge.  Since
 * the subgraph already provides `tokenUri`, we resolve IPFS in parallel,
 * with an in-memory cache so repeated renders are instant.
 */
async function resolveNFTsMetadata(
  nfts: GqlNFT[],
  collectionAddress?: string,
): Promise<NFTItemWithMarket[]> {
  const metaResults = await Promise.all(
    nfts.map((nft) => resolveTokenMeta(nft.tokenUri ?? "")),
  );

  return nfts.map((nft, i) => {
    const meta = metaResults[i];
    const activeListing = nft.listing?.active ? nft.listing : null;
    const topOfferRaw = nft.offers?.[0]?.amount;

    return {
      tokenId: nft.tokenId,
      name: meta?.name || `NFT #${nft.tokenId}`,
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
      const items = await resolveNFTsMetadata(raw, collectionAddress);
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
  onlyListed: boolean = false,
  search: string = "",
  sort: string = "default",
) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const skip = (page - 1) * pageSize;

  // Build the GraphQL 'where' filter
  const where: any = {};
  if (collectionAddress) {
    where.collection = collectionAddress.toLowerCase();
  }
  if (onlyListed) {
    where.listing_ = { active: true };
  }
  if (search.trim() !== "") {
    // Basic server-side search by Token ID if it looks like a number
    if (/^\d+$/.test(search.trim())) {
      where.tokenId = search.trim();
    }
  }

  // Build the GraphQL 'orderBy' and 'orderDirection'
  let orderBy = "tokenId";
  let orderDirection = "asc";

  switch (sort) {
    case "price_asc":
      where.listing_ = { active: true };
      orderBy = "listing__price";
      orderDirection = "asc";
      break;
    case "price_desc":
      where.listing_ = { active: true };
      orderBy = "listing__price";
      orderDirection = "desc";
      break;
    case "id_desc":
      orderBy = "tokenId";
      orderDirection = "desc";
      break;
    case "listed_first":
      // Some subgraphs support this via a specific field or we stay with tokenId
      orderBy = "listing__active";
      orderDirection = "desc";
      break;
    default:
      orderBy = "tokenId";
      orderDirection = "asc";
  }

  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: refetchNfts,
  } = useQuery<GqlNFTsData>(collectionAddress ? GET_NFTS_FOR_CONTRACT : GET_ALL_NFTS, {
    variables: {
      collection: collectionAddress?.toLowerCase(),
      first: pageSize + 1,
      skip,
      where,
      orderBy,
      orderDirection,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (gqlLoading) {
        if (!cancelled) setIsLoading(true);
        return;
      }
      const rawAll = gqlData?.nfts ?? [];
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
      const items = await resolveNFTsMetadata(raw, collectionAddress);
      if (!cancelled) {
        setNfts(items);
        setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [gqlData, gqlLoading, collectionAddress, pageSize]);

  const refetch = useCallback(async () => {
    await refetchNfts();
  }, [refetchNfts]);

  return { nfts, isLoading, hasMore, refetch };
}
