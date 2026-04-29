"use client";

import { useCallback, useMemo } from "react";
import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import {
  GET_ACTIVITY_FEED,
  GET_ACTIVITY_FEED_ALL,
} from "@/lib/graphql/queries";
import { POLL_ACTIVITY_MS } from "@/constants/polling";
import type { ActivityType, ActivityEvent } from "@/types/marketplace";
import { useSubgraphState } from "@/lib/subgraphState";
import type { SubgraphState } from "@/lib/subgraphErrors";
import { useRefetchOnWindowFocus } from "@/hooks/useRefetchOnWindowFocus";

export type { ActivityType, ActivityEvent };

export interface ActivityFeedResult {
  events: ActivityEvent[];
  isLoading: boolean;
  subgraphState: SubgraphState;
}

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

export function useActivityFeed(
  filterContract?: string,
  limit = 50,
): ActivityFeedResult {
  type GqlEvent = {
    id: string;
    type: string;
    nftContract: string;
    tokenId: string;
    from: string;
    to?: string;
    price?: string;
    timestamp: string;
    txHash: string;
  };
  type GqlActivityData = { activityEvents: GqlEvent[] };

  const subgraphState = useSubgraphState();

  const {
    data: gqlAll,
    loading: loadingAll,
    refetch: refetchAll,
  } = useQuery<GqlActivityData>(GET_ACTIVITY_FEED_ALL, {
    skip: !!filterContract,
    variables: { first: limit },
    pollInterval: POLL_ACTIVITY_MS,
    notifyOnNetworkStatusChange: false,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: gqlFiltered,
    loading: loadingFiltered,
    refetch: refetchFiltered,
  } = useQuery<GqlActivityData>(GET_ACTIVITY_FEED, {
    skip: !filterContract,
    variables: { first: limit, nftContract: filterContract },
    pollInterval: POLL_ACTIVITY_MS,
    notifyOnNetworkStatusChange: false,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const refetchActive = useCallback(() => {
    if (filterContract) refetchFiltered();
    else refetchAll();
  }, [filterContract, refetchAll, refetchFiltered]);

  useRefetchOnWindowFocus(refetchActive);

  const events: ActivityEvent[] = useMemo(() => {
    const rawEvents: GqlEvent[] =
      (filterContract ? gqlFiltered?.activityEvents : gqlAll?.activityEvents) ??
      [];

    return rawEvents.map((e) => ({
      id: e.id,
      type: e.type as ActivityType,
      nftContract: e.nftContract,
      tokenId: e.tokenId,
      from: e.from,
      to: e.to,
      priceETH: e.price ? formatEther(BigInt(e.price)) : undefined,
      txHash: e.txHash,
      blockNumber: BigInt(0),
      timestamp: e.timestamp ? Number(e.timestamp) : undefined,
    }));
  }, [gqlAll, gqlFiltered, filterContract]);

  return {
    events,
    isLoading: filterContract ? loadingFiltered : loadingAll,
    subgraphState,
  };
}
