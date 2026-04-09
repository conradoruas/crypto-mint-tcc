"use client";

import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { NFT_COLLECTION_ABI } from "@/constants/contracts";
import { ensureAddress } from "@/lib/schemas";
import { GET_COLLECTION } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

type GqlCollection = {
  id: string;
  contractAddress: string;
  creator: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: string;
  mintPrice: string;
  totalSupply: string;
};

type GqlCollectionData = { collection: GqlCollection | null };

/**
 * Hook to fetch detailed metadata and on-chain state for a specific NFT collection.
 * Uses subgraph for metadata when available, RPC only for `owner` (not indexed).
 */
export function useCollectionDetails(collectionAddress: string | undefined) {
  const enabled = !!collectionAddress;
  const addr = ensureAddress(collectionAddress);

  // ── Subgraph path (metadata) ──
  const { data: gqlData, loading: gqlLoading } = useQuery<GqlCollectionData>(
    GET_COLLECTION,
    {
      skip: !SUBGRAPH_ENABLED || !enabled,
      variables: { id: collectionAddress?.toLowerCase() },
    },
  );

  const gqlCol = gqlData?.collection;

  // ── RPC path (full metadata when subgraph disabled, owner always) ──
  const rpcEnabled = enabled && !SUBGRAPH_ENABLED;

  const base = {
    address: addr,
    abi: NFT_COLLECTION_ABI,
  } as const;

  const { data: rpcName } = useReadContract({
    ...base,
    functionName: "name",
    query: { enabled: rpcEnabled },
  });
  const { data: rpcSymbol } = useReadContract({
    ...base,
    functionName: "symbol",
    query: { enabled: rpcEnabled },
  });
  const { data: owner } = useReadContract({
    ...base,
    functionName: "owner",
    query: { enabled },
  });
  const { data: rpcMintPrice } = useReadContract({
    ...base,
    functionName: "mintPrice",
    query: { enabled: rpcEnabled },
  });
  const { data: rpcMaxSupply } = useReadContract({
    ...base,
    functionName: "maxSupply",
    query: { enabled: rpcEnabled },
  });
  const { data: rpcTotalSupply } = useReadContract({
    ...base,
    functionName: "totalSupply",
    query: { enabled: rpcEnabled },
  });
  const { data: rpcDescription } = useReadContract({
    ...base,
    functionName: "collectionDescription",
    query: { enabled: rpcEnabled },
  });
  const { data: rpcImage } = useReadContract({
    ...base,
    functionName: "collectionImage",
    query: { enabled: rpcEnabled },
  });

  // ── Unified result ──
  return useMemo(() => {
    if (SUBGRAPH_ENABLED && gqlCol) {
      const mintPriceBig = BigInt(gqlCol.mintPrice ?? 0);
      return {
        name: gqlCol.name,
        symbol: gqlCol.symbol,
        description: gqlCol.description || undefined,
        image: gqlCol.image || undefined,
        mintPrice: mintPriceBig,
        mintPriceEth: formatEther(mintPriceBig),
        maxSupply: BigInt(gqlCol.maxSupply ?? 0),
        totalSupply: BigInt(gqlCol.totalSupply ?? 0),
        owner: ensureAddress(owner),
        isLoading: gqlLoading,
      };
    }

    const mintPrice = rpcMintPrice as bigint | undefined;
    return {
      name: rpcName as string | undefined,
      symbol: rpcSymbol as string | undefined,
      description: rpcDescription as string | undefined,
      image: rpcImage as string | undefined,
      mintPrice,
      mintPriceEth: mintPrice ? formatEther(mintPrice) : null,
      maxSupply: rpcMaxSupply as bigint | undefined,
      totalSupply: rpcTotalSupply as bigint | undefined,
      owner: ensureAddress(owner),
      isLoading: false,
    };
  }, [
    gqlCol,
    gqlLoading,
    owner,
    rpcName,
    rpcSymbol,
    rpcDescription,
    rpcImage,
    rpcMintPrice,
    rpcMaxSupply,
    rpcTotalSupply,
  ]);
}
