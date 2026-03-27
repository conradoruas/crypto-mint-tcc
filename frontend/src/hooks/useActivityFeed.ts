"use client";

import { formatEther } from "viem";
import { useQuery } from "@apollo/client/react";
import {
  GET_ACTIVITY_FEED,
  GET_ACTIVITY_FEED_ALL,
} from "@/lib/graphql/queries";
import type { ActivityType, ActivityEvent } from "@/types/marketplace";

export type { ActivityType, ActivityEvent };

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

export function useActivityFeed(filterContract?: string, limit = 50) {
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

  const { data: gqlAll, loading: loadingAll } = useQuery<GqlActivityData>(
    GET_ACTIVITY_FEED_ALL,
    {
      skip: !!filterContract,
      variables: { first: limit },
      pollInterval: 30_000,
    },
  );

  const { data: gqlFiltered, loading: loadingFiltered } =
    useQuery<GqlActivityData>(GET_ACTIVITY_FEED, {
      skip: !filterContract,
      variables: { first: limit, nftContract: filterContract },
      pollInterval: 30_000,
    });

  const rawEvents: GqlEvent[] =
    (filterContract ? gqlFiltered?.activityEvents : gqlAll?.activityEvents) ??
    [];

  const events: ActivityEvent[] = rawEvents.map((e) => ({
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

  return {
    events,
    isLoading: filterContract ? loadingFiltered : loadingAll,
  };
}
