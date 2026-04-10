"use client";

import { useReadContract, useReadContracts } from "wagmi";
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
 * When subgraph is disabled, all fields are fetched via a single multicall batch.
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

  // ── RPC path (batched multicall instead of 8 separate calls) ──
  const rpcEnabled = enabled && !SUBGRAPH_ENABLED;

  const base = {
    address: addr,
    abi: NFT_COLLECTION_ABI,
  } as const;

  const rpcContracts = useMemo(
    () =>
      rpcEnabled
        ? [
            { ...base, functionName: "name" as const },
            { ...base, functionName: "symbol" as const },
            { ...base, functionName: "collectionDescription" as const },
            { ...base, functionName: "collectionImage" as const },
            { ...base, functionName: "mintPrice" as const },
            { ...base, functionName: "maxSupply" as const },
            { ...base, functionName: "totalSupply" as const },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rpcEnabled, addr],
  );

  const { data: rpcResults } = useReadContracts({
    contracts: rpcContracts,
    query: { enabled: rpcEnabled && rpcContracts.length > 0 },
  });

  // Owner is always fetched via RPC (not indexed in subgraph)
  const { data: owner } = useReadContract({
    ...base,
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
        owner: ensureAddress(owner),
        isLoading: gqlLoading,
      };
    }

    // Extract multicall results (order matches rpcContracts)
    const rpcName = rpcResults?.[0]?.result as string | undefined;
    const rpcSymbol = rpcResults?.[1]?.result as string | undefined;
    const rpcDescription = rpcResults?.[2]?.result as string | undefined;
    const rpcImage = rpcResults?.[3]?.result as string | undefined;
    const mintPrice = rpcResults?.[4]?.result as bigint | undefined;
    const rpcMaxSupply = rpcResults?.[5]?.result as bigint | undefined;
    const rpcTotalSupply = rpcResults?.[6]?.result as bigint | undefined;

    return {
      name: rpcName,
      symbol: rpcSymbol,
      description: rpcDescription,
      image: rpcImage,
      mintPrice,
      mintPriceEth: mintPrice ? formatEther(mintPrice) : null,
      maxSupply: rpcMaxSupply,
      totalSupply: rpcTotalSupply,
      owner: ensureAddress(owner),
      isLoading: false,
    };
  }, [gqlCol, gqlLoading, owner, rpcResults]);
}
