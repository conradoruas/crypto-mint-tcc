"use client";
import { SUBGRAPH_ENABLED } from "@/lib/publicEnv";

import { useReadContract, useReadContracts, useConnection } from "wagmi";
import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  FACTORY_ADDRESS,
  NFT_COLLECTION_ABI,
  NFT_COLLECTION_FACTORY_ABI,
} from "@/constants/contracts";
import {
  GET_COLLECTIONS,
  GET_COLLECTIONS_BY_CREATOR,
} from "@/lib/graphql/queries";
import type { CollectionInfo } from "@/types/collection";
export type { CollectionInfo };
import { parseAddress } from "@/lib/schemas";
import { useSubgraphState } from "@/lib/subgraphState";
import { useRefetchOnWindowFocus } from "@/hooks/useRefetchOnWindowFocus";


/**
 * Hook to fetch collections created via the factory, with Subgraph/RPC fallback.
 *
 * Source selection:
 *   - SUBGRAPH_ENABLED && subgraphState !== 'down'  → GraphQL (paginated)
 *   - otherwise                                     → factory.getAllCollections() + multicall totalSupply
 *
 * The 'down' switch lets us keep serving the collections grid even when the
 * subgraph is fully rate-limited and has no cached fallback to offer.
 */
export function useCollections(page: number = 1, pageSize: number = 100) {
  const subgraphState = useSubgraphState();
  const useSubgraph = SUBGRAPH_ENABLED && subgraphState !== "down";
  const skip = (page - 1) * pageSize;

  // ── GraphQL path ──
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
  type GqlCollectionsData = { collections: GqlCollection[] };

  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: gqlRefetch,
  } = useQuery<GqlCollectionsData>(GET_COLLECTIONS, {
    skip: !useSubgraph,
    variables: { first: pageSize, skip },
  });

  // ── RPC path ──
  // (Note: RPC getAllCollections returns all collections; pagination is applied
  //  client-side below.)
  const {
    data: raw,
    isLoading: rpcLoading,
    refetch: rpcRefetch,
  } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: NFT_COLLECTION_FACTORY_ABI,
    functionName: "getAllCollections",
    query: { enabled: !!FACTORY_ADDRESS && !useSubgraph },
  });

  const rawCollections = useMemo(
    () => (raw as CollectionInfo[] | undefined) ?? [],
    [raw],
  );

  const supplyContracts = useMemo(
    () =>
      rawCollections.map((c) => ({
        address: c.contractAddress as `0x${string}`,
        abi: NFT_COLLECTION_ABI,
        functionName: "totalSupply" as const,
      })),
    [rawCollections],
  );

  const { data: suppliesData, isLoading: isLoadingSupply } = useReadContracts({
    contracts: supplyContracts,
    query: { enabled: !useSubgraph && rawCollections.length > 0 },
  });

  const rpcCollections = useMemo(() => {
    return rawCollections.map((c, i) => ({
      ...c,
      totalSupply: (suppliesData?.[i]?.result as bigint) ?? BigInt(0),
    }));
  }, [rawCollections, suppliesData]);

  const collections = useMemo(() => {
    if (useSubgraph) {
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
  }, [useSubgraph, gqlData?.collections, rpcCollections]);

  const refetch = useSubgraph
    ? (gqlRefetch as () => void)
    : (rpcRefetch as () => void);

  useRefetchOnWindowFocus(refetch);

  return {
    collections,
    isLoading: useSubgraph ? gqlLoading : rpcLoading || isLoadingSupply,
    refetch,
    subgraphState,
  };
}

/**
 * Hook to fetch collections created by the currently connected user.
 * Uses a server-side `where: { creator }` filter instead of fetching all and
 * filtering on the client.
 */
export function useCreatorCollections() {
  const { address } = useConnection();
  const subgraphState = useSubgraphState();
  const useSubgraph = SUBGRAPH_ENABLED && subgraphState !== "down";

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
  type GqlCollectionsData = { collections: GqlCollection[] };

  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: gqlRefetch,
  } = useQuery<GqlCollectionsData>(GET_COLLECTIONS_BY_CREATOR, {
    skip: !useSubgraph || !address,
    variables: { creator: address?.toLowerCase() ?? "", first: 100, skip: 0 },
  });

  // RPC fallback: fetch all and filter client-side (only when subgraph is unavailable)
  const { collections: allCollections, isLoading: rpcLoading } = useCollections();
  const rpcMyCollections = useMemo(
    () =>
      allCollections.filter(
        (c) => address && c.creator.toLowerCase() === address.toLowerCase(),
      ),
    [allCollections, address],
  );

  const gqlCollections = useMemo(
    () =>
      (gqlData?.collections ?? []).flatMap((c) => {
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
      }),
    [gqlData?.collections],
  );

  if (useSubgraph) {
    return {
      collections: gqlCollections,
      isLoading: gqlLoading,
      refetch: gqlRefetch as () => void,
      subgraphState,
    };
  }

  return {
    collections: rpcMyCollections,
    isLoading: rpcLoading,
    refetch: () => {},
    subgraphState,
  };
}
