"use client";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

import { useReadContract, useReadContracts } from "wagmi";
import { formatEther, zeroAddress } from "viem";
import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { NFT_COLLECTION_ABI } from "@/constants/contracts";
import { parseAddress } from "@/lib/schemas";
import { GET_COLLECTION } from "@/lib/graphql/queries";


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
 * When subgraph is disabled, all fields are fetched via a single multicall batch.
 */
export function useCollectionDetails(collectionAddress: string | undefined) {
  const addr = parseAddress(collectionAddress);
  const enabled = !!addr;

  // ── Subgraph path (metadata) ──
  const { data: gqlData, loading: gqlLoading } = useQuery<GqlCollectionData>(
    GET_COLLECTION,
    {
      skip: !SUBGRAPH_ENABLED || !enabled,
      variables: { id: collectionAddress?.toLowerCase() },
    },
  );

  const gqlCol = gqlData?.collection;

  // ── RPC path (batched multicall instead of 8 separate calls) ──
  const rpcEnabled = enabled && !SUBGRAPH_ENABLED;

  const rpcAddress = addr ?? zeroAddress;

  const { data: rpcResults, isLoading: rpcLoading } = useReadContracts({
    contracts: [
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "name" },
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "symbol" },
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "collectionDescription" },
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "collectionImage" },
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "mintPrice" },
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "maxSupply" },
      { address: rpcAddress, abi: NFT_COLLECTION_ABI, functionName: "totalSupply" },
    ] as const,
    query: { enabled: rpcEnabled },
  });

  // Owner is always fetched via RPC (not indexed in subgraph)
  const { data: owner, isLoading: ownerLoading } = useReadContract({
    address: rpcAddress,
    abi: NFT_COLLECTION_ABI,
    functionName: "owner",
    query: { enabled },
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
        owner: parseAddress(owner as string | undefined),
        isLoading: gqlLoading || ownerLoading,
      };
    }

    const rpcName = rpcResults?.[0]?.result;
    const rpcSymbol = rpcResults?.[1]?.result;
    const rpcDescription = rpcResults?.[2]?.result;
    const rpcImage = rpcResults?.[3]?.result;
    const mintPrice = rpcResults?.[4]?.result;
    const rpcMaxSupply = rpcResults?.[5]?.result;
    const rpcTotalSupply = rpcResults?.[6]?.result;

    return {
      name: rpcName,
      symbol: rpcSymbol,
      description: rpcDescription,
      image: rpcImage,
      mintPrice,
      mintPriceEth: mintPrice ? formatEther(mintPrice) : null,
      maxSupply: rpcMaxSupply,
      totalSupply: rpcTotalSupply,
      owner: parseAddress(owner as string | undefined),
      isLoading:
        enabled &&
        (rpcLoading || ownerLoading || !rpcResults || owner === undefined),
    };
  }, [enabled, gqlCol, gqlLoading, owner, ownerLoading, rpcLoading, rpcResults]);
}
