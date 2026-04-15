import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import { useNowBucketed } from "../useNowBucketed";
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

/**
 * Simple LRU cache keyed by tokenUri — metadata is immutable once pinned.
 * Capped at 500 entries to prevent unbounded memory growth on long sessions.
 */
const LRU_MAX = 500;
const ipfsMetaCache = new Map<string, IpfsMeta>();

function lruGet(key: string): IpfsMeta | undefined {
  const val = ipfsMetaCache.get(key);
  if (val !== undefined) {
    // Move to end (most recently used)
    ipfsMetaCache.delete(key);
    ipfsMetaCache.set(key, val);
  }
  return val;
}

function lruSet(key: string, val: IpfsMeta): void {
  if (ipfsMetaCache.has(key)) ipfsMetaCache.delete(key);
  ipfsMetaCache.set(key, val);
  if (ipfsMetaCache.size > LRU_MAX) {
    // Delete oldest (first) entry
    const oldest = ipfsMetaCache.keys().next().value;
    if (oldest !== undefined) ipfsMetaCache.delete(oldest);
  }
}

async function resolveTokenMeta(tokenUri: string): Promise<IpfsMeta | null> {
  if (!tokenUri) return null;

  const cached = lruGet(tokenUri);
  if (cached) return cached;

  try {
    const res = await fetch(resolveIpfsUrl(tokenUri));
    const json = await res.json();
    const meta: IpfsMeta = {
      name: json.name ?? "",
      description: json.description ?? "",
      image: resolveIpfsUrl(json.image ?? ""),
    };
    lruSet(tokenUri, meta);
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
    const now = Math.floor(Date.now() / 1000);
    const activeListing = nft.listing?.active ? nft.listing : null;
    const topOfferRaw = (nft.offers ?? []).find(o => !o.expiresAt || BigInt(o.expiresAt) > now)?.amount;

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

  // Bucketed timestamp that auto-refreshes every 60s so expired offers are filtered out.
  const nowBucketed = useNowBucketed();

  const {
    data: gqlData,
    loading: gqlQueryLoading,
    refetch: refetchGql,
  } = useQuery<GqlNFTsData>(GET_NFTS_FOR_CONTRACT, {
    skip: !collectionAddress,
    variables: {
      first: pageSize,
      skip,
      where: { collection: collectionAddress?.toLowerCase() },
      orderBy: "tokenId",
      orderDirection: "asc",
      now: nowBucketed,
    },
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

  const nowBucketed = useNowBucketed();

  // Build the GraphQL 'where' filter
  const where: Record<string, unknown> = {};
  if (collectionAddress) {
    where.collection = collectionAddress.toLowerCase();
  }
  if (onlyListed) {
    where.listing_ = { active: true };
  }
  if (search.trim() !== "" && /^\d+$/.test(search.trim())) {
    where.tokenId = search.trim();
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
    case "offer_desc":
      // Restrict to NFTs that have at least one currently-active offer.
      // The Graph cannot order parents by a child-aggregate, so we
      // post-sort by topOffer per page in the effect below.
      where.offers_ = { active: true, expiresAt_gt: nowBucketed };
      orderBy = "tokenId";
      orderDirection = "asc";
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
      first: pageSize + 1,
      skip,
      where,
      orderBy,
      orderDirection,
      now: nowBucketed,
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
      const sorted =
        sort === "offer_desc"
          ? items
              .filter((i) => i.topOffer !== null)
              .sort(
                (a, b) =>
                  parseFloat(b.topOffer ?? "0") -
                  parseFloat(a.topOffer ?? "0"),
              )
          : items;
      if (!cancelled) {
        setNfts(sorted);
        setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [gqlData, gqlLoading, collectionAddress, pageSize, sort]);

  const refetch = useCallback(async () => {
    await refetchNfts();
  }, [refetchNfts]);

  return { nfts, isLoading, hasMore, refetch };
}
