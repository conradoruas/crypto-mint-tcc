"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
} from "wagmi";
import { parseEther, formatEther, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";
import { GET_COLLECTIONS } from "@/lib/graphql/queries";
import type { AlchemyNFT } from "@/types/alchemy";
import type { CollectionInfo } from "@/types/collection";
import type { CollectionNFTItem, CreatedNFTItem } from "@/types/nft";
import { resolveIpfsUrl } from "@/lib/ipfs";
import { useStableArray } from "./useStableArray";
import { ensureAddress, parseAddress } from "@/lib/schemas";

export type { CollectionInfo, CollectionNFTItem, CreatedNFTItem };

// ─────────────────────────────────────────────
// Endereços
// ─────────────────────────────────────────────

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const FACTORY_ADDRESS = ensureAddress(
  process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS,
);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("/api/rpc"),
});

// ─────────────────────────────────────────────
// useProfileNFTs
// Busca NFTs de um endereço em uma coleção via Alchemy
// ─────────────────────────────────────────────

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
        console.error("Erro ao buscar NFTs do perfil:", error);
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

// ─────────────────────────────────────────────
// useCollections
// Busca todas as coleções criadas na factory
// ─────────────────────────────────────────────

export function useCollections() {
  // ── GraphQL path ──
  type GqlCollectionsData = { collections: GqlCollection[] };
  type GqlCollection = {
    contractAddress: string;
    creator: string;
    name: string;
    symbol: string;
    description?: string;
    image?: string;
    maxSupply?: string;
    mintPrice?: string;
    createdAt?: string;
    totalSupply?: string;
  };

  // ── GraphQL path ──
  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: gqlRefetch,
  } = useQuery<GqlCollectionsData>(GET_COLLECTIONS, {
    skip: !SUBGRAPH_ENABLED,
  });

  // ── RPC path ──
  const {
    data: raw,
    isLoading: rpcLoading,
    refetch: rpcRefetch,
  } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getAllCollections",
    query: { enabled: !!FACTORY_ADDRESS && !SUBGRAPH_ENABLED },
  });

  const [rpcCollections, setRpcCollections] = useState<CollectionInfo[]>([]);
  const [isLoadingSupply, setIsLoadingSupply] = useState(false);

  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;
    const rawCollections = (raw as CollectionInfo[] | undefined) ?? [];
    if (rawCollections.length === 0) return;

    const fetchSupplies = async () => {
      setIsLoadingSupply(true);
      const withSupply = await Promise.all(
        rawCollections.map(async (c) => {
          try {
            const supply = (await publicClient.readContract({
              address: c.contractAddress,
              abi: NFT_COLLECTION_ABI,
              functionName: "totalSupply",
            })) as bigint;
            return { ...c, totalSupply: supply };
          } catch {
            return { ...c, totalSupply: BigInt(0) };
          }
        }),
      );
      setRpcCollections(withSupply);
      setIsLoadingSupply(false);
    };

    fetchSupplies();
  }, [raw]);

  const collections = useMemo(() => {
    if (SUBGRAPH_ENABLED) {
      return (gqlData?.collections ?? []).flatMap((c) => {
        const contractAddress = parseAddress(c.contractAddress);
        const creator = parseAddress(c.creator);
        if (!contractAddress || !creator) return [];
        return [{
          contractAddress,
          creator,
          name: c.name,
          symbol: c.symbol,
          description: c.description ?? "",
          image: c.image ?? "",
          maxSupply: BigInt(c.maxSupply ?? 0),
          mintPrice: BigInt(c.mintPrice ?? 0),
          createdAt: BigInt(c.createdAt ?? 0),
          totalSupply: BigInt(c.totalSupply ?? 0),
        }];
      });
    }
    return rpcCollections;
  }, [gqlData?.collections, rpcCollections]);

  return {
    collections,
    isLoading: SUBGRAPH_ENABLED ? gqlLoading : rpcLoading || isLoadingSupply,
    refetch: (SUBGRAPH_ENABLED ? gqlRefetch : rpcRefetch) as () => void,
  };
}

// ─────────────────────────────────────────────
// useCreatorCollections
// Busca as coleções criadas pelo usuário conectado
// ─────────────────────────────────────────────

export function useCreatorCollections() {
  const { address } = useConnection();
  const { collections, isLoading } = useCollections();

  const myCollections = collections.filter(
    (c) => address && c.creator.toLowerCase() === address.toLowerCase(),
  );

  return { collections: myCollections, isLoading };
}

// ─────────────────────────────────────────────
// useCreatedNFTs
// Busca todos os NFTs das coleções criadas pelo usuário
// ─────────────────────────────────────────────

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
        console.error("Erro ao buscar NFTs criados:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [ownerAddress, isLoadingCollections, stableCollections]);

  return { nfts, isLoading };
}

// ─────────────────────────────────────────────
// useCreateCollection
// Cria uma nova coleção via factory
// ─────────────────────────────────────────────

export function useCreateCollection() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createCollection = async (params: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    maxSupply: number;
    mintPrice: string;
  }) => {
    await mutateAsync({
      address: FACTORY_ADDRESS,
      abi: NFT_COLLECTION_FACTORY_ABI,
      functionName: "createCollection",
      args: [
        params.name,
        params.symbol,
        params.description,
        params.image,
        BigInt(params.maxSupply),
        parseEther(params.mintPrice),
      ],
      gas: BigInt(5000000),
    });
  };

  return { createCollection, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// useMintToCollection
// Minta um NFT em uma coleção específica
// ─────────────────────────────────────────────

export function useMintToCollection() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const { address } = useConnection();

  const mint = async (
    collectionAddress: `0x${string}`,
    mintPriceInEth: string,
    recipientAddress?: `0x${string}`,
  ) => {
    const to = recipientAddress ?? address;
    if (!to) throw new Error("Carteira não conectada");

    await mutateAsync({
      address: collectionAddress,
      abi: NFT_COLLECTION_ABI,
      functionName: "mint",
      args: [to],
      value: parseEther(mintPriceInEth),
      gas: BigInt(300000),
    });
  };

  return { mint, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// useCollectionNFTs
// Busca os NFTs de uma coleção específica via Alchemy
// ─────────────────────────────────────────────

const PAGE_SIZE_COLLECTION = 20;

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
    (data.nfts ?? []).map(async (nft: AlchemyNFT) => {
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
      .catch((error) => console.error("Erro ao buscar NFTs da coleção:", error))
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
      console.error("Erro ao buscar mais NFTs:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return { nfts, isLoading, isLoadingMore, totalSupply, hasMore, loadMore };
}

// ─────────────────────────────────────────────
// useCollectionDetails
// Busca os detalhes de uma coleção específica pelo endereço
// ─────────────────────────────────────────────

export function useCollectionDetails(collectionAddress: string | undefined) {
  const enabled = !!collectionAddress;
  const addr = ensureAddress(collectionAddress);

  const base = {
    address: addr,
    abi: NFT_COLLECTION_ABI,
    query: { enabled },
  } as const;

  const { data: name } = useReadContract({ ...base, functionName: "name" });
  const { data: symbol } = useReadContract({ ...base, functionName: "symbol" });
  const { data: owner } = useReadContract({ ...base, functionName: "owner" });
  const { data: mintPrice } = useReadContract({
    ...base,
    functionName: "mintPrice",
  });
  const { data: maxSupply } = useReadContract({
    ...base,
    functionName: "maxSupply",
  });
  const { data: totalSupply } = useReadContract({
    ...base,
    functionName: "totalSupply",
  });

  const { data: description } = useReadContract({
    address: addr,
    abi: NFT_COLLECTION_ABI,
    functionName: "collectionDescription",
    query: { enabled },
  });

  const { data: image } = useReadContract({
    address: addr,
    abi: NFT_COLLECTION_ABI,
    functionName: "collectionImage",
    query: { enabled },
  });

  return {
    name: name as string | undefined,
    symbol: symbol as string | undefined,
    description: description as string | undefined,
    image: image as string | undefined,
    mintPrice: mintPrice as bigint | undefined,
    mintPriceEth: mintPrice ? formatEther(mintPrice as bigint) : null,
    maxSupply: maxSupply as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    owner: ensureAddress(owner),
  };
}
