import { useEffect, useMemo, useState } from "react";
import { formatEther, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { useQuery } from "@apollo/client/react";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { useCollections } from "@/hooks/useCollections";
import { GET_ALL_NFTS, GET_NFTS_FOR_CONTRACT } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

export interface NFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  nftContract: string;
  collectionName?: string;
}

export interface NFTItemWithMarket extends NFTItem {
  listingPrice: string | null;
  topOffer: string | null;
}

export interface AlchemyNFT {
  tokenId: string;
  name?: string;
  description?: string;
  tokenUri?: string;
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
  };
}

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("/api/rpc"),
});

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

async function fetchTopOffer(
  nftContract: `0x${string}`,
  tokenId: string,
): Promise<string | null> {
  try {
    const buyers = (await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "getOfferBuyers",
      args: [nftContract, BigInt(tokenId)],
    })) as `0x${string}`[];

    if (buyers.length === 0) return null;

    const uniqueBuyers = [...new Set(buyers)];
    const now = BigInt(Math.floor(Date.now() / 1000));

    const offerAmounts = await Promise.all(
      uniqueBuyers.map(async (buyer) => {
        try {
          const offer = (await publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: NFT_MARKETPLACE_ABI,
            functionName: "getOffer",
            args: [nftContract, BigInt(tokenId), buyer],
          })) as {
            buyer: string;
            amount: bigint;
            expiresAt: bigint;
            active: boolean;
          };

          if (offer.active && offer.expiresAt > now) return offer.amount;
          return null;
        } catch {
          return null;
        }
      }),
    );

    const active = offerAmounts.filter((a): a is bigint => a !== null);
    if (active.length === 0) return null;

    const top = active.reduce(
      (max, curr) => (curr > max ? curr : max),
      active[0],
    );
    return formatEther(top);
  } catch {
    return null;
  }
}

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

// Fetch Alchemy metadata for a contract, returns a map tokenId -> {name, description, image}
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

// Merge subgraph NFTs (listing/offer data) with Alchemy metadata
async function mergeWithAlchemy(
  nfts: GqlNFT[],
  collectionAddress?: string,
): Promise<NFTItemWithMarket[]> {
  // Group by contract address
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

  // Fetch Alchemy metadata for all contracts in parallel
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
    } as NFTItemWithMarket;
  });
}

// ─────────────────────────────────────────────
// useExploreNFTs — busca NFTs de uma coleção específica
// ─────────────────────────────────────────────

export function useExploreNFTs(collectionAddress?: string) {
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── GraphQL path ──
  const { data: gqlData, loading: gqlQueryLoading } = useQuery<GqlNFTsData>(
    GET_NFTS_FOR_CONTRACT,
    {
      skip: !SUBGRAPH_ENABLED || !collectionAddress,
      variables: { collection: collectionAddress?.toLowerCase() },
    },
  );

  useEffect(() => {
    if (!SUBGRAPH_ENABLED || !collectionAddress) return;
    if (gqlQueryLoading) return;
    const raw = gqlData?.nfts ?? [];
    if (raw.length === 0) {
      setNfts([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    mergeWithAlchemy(raw, collectionAddress).then((items) => {
      if (cancelled) return; // ← ignora resultado se desmontou
      setNfts(items);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [gqlData, gqlQueryLoading, collectionAddress]);

  // ── RPC path ──
  const nftContract = collectionAddress as `0x${string}` | undefined;

  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;
    if (!nftContract) {
      setNfts([]);
      setIsLoading(false);
      return;
    }

    const fetchNFTs = async () => {
      try {
        const res = await fetch(
          `/api/alchemy/getNFTsForContract?contractAddress=${nftContract}&withMetadata=true&refreshCache=false`,
        );
        const data = await res.json();

        if (!data.nfts || data.nfts.length === 0) {
          setNfts([]);
          return;
        }

        const items: NFTItemWithMarket[] = await Promise.all(
          data.nfts.map(async (nft: AlchemyNFT) => {
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

            let listingPrice: string | null = null;
            try {
              const listing = (await publicClient.readContract({
                address: MARKETPLACE_ADDRESS,
                abi: NFT_MARKETPLACE_ABI,
                functionName: "getListing",
                args: [nftContract, BigInt(nft.tokenId)],
              })) as { seller: string; price: bigint; active: boolean };

              if (listing.active) listingPrice = formatEther(listing.price);
            } catch {
              listingPrice = null;
            }

            const topOffer = await fetchTopOffer(nftContract, nft.tokenId);

            return {
              tokenId: nft.tokenId,
              name: nft.name ?? `NFT #${nft.tokenId}`,
              description: nft.description ?? "",
              image,
              nftContract,
              listingPrice,
              topOffer,
            };
          }),
        );

        setNfts(items);
      } catch (error) {
        console.error("Erro ao buscar NFTs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTs();
  }, [nftContract]);

  return { nfts, isLoading };
}

// ─────────────────────────────────────────────
// useExploreAllNFTs — busca NFTs de todas as coleções
// ─────────────────────────────────────────────

export function useExploreAllNFTs(collectionAddress?: string) {
  const { collections } = useCollections();
  const [nfts, setNfts] = useState<NFTItemWithMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stable key: só muda quando os endereços das coleções realmente mudam
  const collectionKey = useMemo(
    () => collections.map((c) => c.contractAddress).join(","),
    [collections],
  );

  // ── GraphQL path: all NFTs ──
  const { data: gqlAllData, loading: gqlAllLoading } = useQuery<GqlNFTsData>(
    GET_ALL_NFTS,
    {
      skip: !SUBGRAPH_ENABLED || !!collectionAddress,
      variables: { first: 200 },
    },
  );

  // ── GraphQL path: filtered by collection ──
  const { data: gqlColData, loading: gqlColLoading } = useQuery<GqlNFTsData>(
    GET_NFTS_FOR_CONTRACT,
    {
      skip: !SUBGRAPH_ENABLED || !collectionAddress,
      variables: { collection: collectionAddress?.toLowerCase() },
    },
  );

  useEffect(() => {
    if (!SUBGRAPH_ENABLED) return;
    const loading = collectionAddress ? gqlColLoading : gqlAllLoading;
    if (loading) return;
    const raw = collectionAddress
      ? (gqlColData?.nfts ?? [])
      : (gqlAllData?.nfts ?? []);

    if (raw.length === 0) {
      setNfts([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
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
  }, [gqlAllData, gqlColData, gqlAllLoading, gqlColLoading, collectionAddress]);

  // ── RPC path ──
  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;
    if (!collectionKey) {
      setIsLoading(false);
      return;
    }

    const targets = collectionAddress
      ? [collectionAddress]
      : collections.map((c) => c.contractAddress);

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          targets.map(async (addr) => {
            const res = await fetch(
              `/api/alchemy/getNFTsForContract?contractAddress=${addr}&withMetadata=true&refreshCache=false`,
            );
            const data = await res.json();

            return Promise.all(
              (data.nfts ?? []).map(async (nft: AlchemyNFT) => {
                let image =
                  nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "";
                if (!image && nft.tokenUri) {
                  try {
                    const metaRes = await fetch(resolveIpfsUrl(nft.tokenUri));
                    const meta = await metaRes.json();
                    image = resolveIpfsUrl(meta.image ?? "");
                  } catch {
                    image = "";
                  }
                }

                let listingPrice: string | null = null;
                try {
                  const listing = (await publicClient.readContract({
                    address: MARKETPLACE_ADDRESS,
                    abi: NFT_MARKETPLACE_ABI,
                    functionName: "getListing",
                    args: [addr as `0x${string}`, BigInt(nft.tokenId)],
                  })) as { seller: string; price: bigint; active: boolean };
                  if (listing.active) listingPrice = formatEther(listing.price);
                } catch {
                  listingPrice = null;
                }

                const topOffer = await fetchTopOffer(
                  addr as `0x${string}`,
                  nft.tokenId,
                );

                return {
                  tokenId: nft.tokenId,
                  name: nft.name ?? `NFT #${nft.tokenId}`,
                  description: nft.description ?? "",
                  image,
                  nftContract: addr,
                  listingPrice,
                  topOffer,
                } as NFTItemWithMarket;
              }),
            );
          }),
        );

        setNfts(results.flat());
      } catch (error) {
        console.error("Erro ao buscar todos os NFTs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAddress, collectionKey]);

  return { nfts, isLoading };
}
