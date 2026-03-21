"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection, // ✅ corrigido: era useConnection
} from "wagmi";
import { parseEther, formatEther, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { useEffect, useState } from "react";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { NFT_COLLECTION_FACTORY_ABI } from "@/abi/NFTCollectionFactory";

// ─────────────────────────────────────────────
// Endereços
// ─────────────────────────────────────────────

const FACTORY_ADDRESS = process.env
  .NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface CollectionInfo {
  contractAddress: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: bigint;
  mintPrice: bigint;
  createdAt: bigint;
  totalSupply?: bigint;
}

export interface CollectionNFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  nftContract: string;
}

interface AlchemyNFT {
  tokenId: string;
  name?: string;
  description?: string;
  tokenUri?: string;
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
  };
}

const resolveIpfsUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};

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

  const nftContract =
    collectionAddress ?? process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS;

  useEffect(() => {
    if (!ownerAddress) {
      setIsLoading(false);
      return;
    }

    const fetchNFTs = async () => {
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${ownerAddress}&contractAddresses[]=${nftContract}&withMetadata=true`,
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
              nftContract: nftContract as string,
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

    fetchNFTs();
  }, [ownerAddress, nftContract]);

  return { nfts, isLoading };
}

// ─────────────────────────────────────────────
// useCollections
// Busca todas as coleções criadas na factory
// ─────────────────────────────────────────────

export function useCollections() {
  const {
    data: raw,
    isLoading,
    refetch,
  } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getAllCollections",
    query: { enabled: !!FACTORY_ADDRESS },
  });

  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [isLoadingSupply, setIsLoadingSupply] = useState(false);

  // Busca totalSupply de cada coleção após carregar a lista
  useEffect(() => {
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
      setCollections(withSupply);
      setIsLoadingSupply(false);
    };

    fetchSupplies();
  }, [raw]);

  return { collections, isLoading: isLoading || isLoadingSupply, refetch };
}

// ─────────────────────────────────────────────
// useCreatorCollections
// Busca as coleções criadas pelo usuário conectado
// ─────────────────────────────────────────────

export function useCreatorCollections() {
  const { address } = useConnection(); // ✅ corrigido
  const { collections, isLoading } = useCollections();

  const myCollections = collections.filter(
    (c) => address && c.creator.toLowerCase() === address.toLowerCase(),
  );

  return { collections: myCollections, isLoading };
}

// ─────────────────────────────────────────────
// useCreateCollection
// Cria uma nova coleção via factory
// ─────────────────────────────────────────────

export function useCreateCollection() {
  const { data: hash, mutateAsync, isPending } = useWriteContract(); // ✅ corrigido

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
  const { data: hash, mutateAsync, isPending } = useWriteContract(); // ✅ corrigido
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const { address } = useConnection(); // ✅ corrigido

  const mint = async (
    collectionAddress: `0x${string}`,
    tokenUri: string,
    mintPriceInEth: string,
    recipientAddress?: `0x${string}`,
  ) => {
    const to = recipientAddress ?? address;
    if (!to) throw new Error("Carteira não conectada");

    await mutateAsync({
      // ✅ corrigido
      address: collectionAddress,
      abi: NFT_COLLECTION_ABI,
      functionName: "mint",
      args: [to, tokenUri],
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

export function useCollectionNFTs(collectionAddress: string | undefined) {
  const [nfts, setNfts] = useState<CollectionNFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSupply, setTotalSupply] = useState<number>(0);

  useEffect(() => {
    if (!collectionAddress) {
      setIsLoading(false);
      return;
    }

    const fetchNFTs = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForContract?contractAddress=${collectionAddress}&withMetadata=true&refreshCache=false`,
        );
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

        setNfts(items);
        setTotalSupply(items.length);
      } catch (error) {
        console.error("Erro ao buscar NFTs da coleção:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTs();
  }, [collectionAddress]);

  return { nfts, isLoading, totalSupply };
}

// ─────────────────────────────────────────────
// useCollectionDetails
// Busca os detalhes de uma coleção específica pelo endereço
// ─────────────────────────────────────────────

export function useCollectionDetails(collectionAddress: string | undefined) {
  const enabled = !!collectionAddress;
  const addr = collectionAddress as `0x${string}`;

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
    owner: owner as `0x${string}` | undefined,
  };
}
