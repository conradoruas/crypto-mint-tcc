"use client";

import { useReadContract, useReadContracts, useConnection } from "wagmi";
import { formatEther } from "viem";
import { useCallback, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
} from "@/constants/contracts";
import { GET_OFFERS_FOR_NFT } from "@/lib/graphql/queries";
import type { OfferData, OfferWithBuyer } from "@/types/marketplace";
import { ensureAddress, parseAddress } from "@/lib/schemas";
import { MAX_OFFER_BUYERS_MULTICALL } from "@/constants/polling";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

// ─── Helpers ───

type GqlOfferRow = {
  buyer: string;
  amount: string;
  expiresAt: string;
  active: boolean;
};

function buildChainOfferMap(
  buyersRaw: readonly `0x${string}`[] | undefined,
  offerRows: readonly { result?: unknown; status?: string }[] | undefined,
): Map<string, OfferWithBuyer> {
  const m = new Map<string, OfferWithBuyer>();
  if (
    !buyersRaw ||
    !Array.isArray(buyersRaw) ||
    !offerRows ||
    offerRows.length !== buyersRaw.length
  ) {
    return m;
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let i = 0; i < buyersRaw.length; i++) {
    const row = offerRows[i]?.result as OfferData | undefined;
    if (!row?.active || now > row.expiresAt) continue;
    const buyer = parseAddress(row.buyer) ?? parseAddress(buyersRaw[i]!);
    if (!buyer) continue;
    m.set(buyer.toLowerCase(), {
      buyer,
      buyerAddress: buyer,
      amount: row.amount,
      expiresAt: row.expiresAt,
      active: true,
    });
  }
  return m;
}

function indexerOffersFromGql(gqlOffers: GqlOfferRow[] | undefined) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const out: OfferWithBuyer[] = [];
  for (const o of gqlOffers ?? []) {
    if (!o.active || BigInt(o.expiresAt) <= now) continue;
    const buyer = parseAddress(o.buyer);
    if (!buyer) continue;
    out.push({
      buyer,
      buyerAddress: buyer,
      amount: BigInt(o.amount),
      expiresAt: BigInt(o.expiresAt),
      active: true,
    });
  }
  out.sort((a, b) =>
    a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1,
  );
  return out;
}

const NO_OFFER_BUYERS: readonly `0x${string}`[] = [];

// ─── Hooks ───

/**
 * Hook to fetch the offer made by the currently connected user.
 */
export function useMyOffer(nftContract: string, tokenId: string) {
  const { address } = useConnection();
  const { data: offer, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getOffer",
    args: [
      ensureAddress(nftContract),
      BigInt(tokenId || "0"),
      address ?? "0x0000000000000000000000000000000000000000",
    ],
    query: { enabled: !!address && !!nftContract && !!tokenId },
  });

  const offerData = offer as OfferData | undefined;
  const isExpired =
    offerData?.active &&
    BigInt(Math.floor(Date.now() / 1000)) > offerData.expiresAt;

  return {
    offer: offerData,
    hasActiveOffer: offerData?.active && !isExpired,
    isExpired,
    offerAmount: offerData?.active ? formatEther(offerData.amount) : null,
    expiresAt: offerData?.expiresAt
      ? new Date(Number(offerData.expiresAt) * 1000)
      : null,
    refetch,
  };
}

/**
 * Hook to fetch all offers for a specific NFT, using subgraph with RPC fallback.
 */
export function useNFTOffers(nftContract: string, tokenId: string) {
  const { address } = useConnection();
  const userAddress = address?.toLowerCase();

  const enabled = !!nftContract && !!tokenId;
  const nftAddr = ensureAddress(nftContract);
  const tokenIdBn = BigInt(tokenId || "0");

  // ── Subgraph path ──
  type GqlOffersData = { offers: GqlOfferRow[] };
  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: gqlRefetch,
  } = useQuery<GqlOffersData>(GET_OFFERS_FOR_NFT, {
    skip: !enabled || !SUBGRAPH_ENABLED,
    variables: {
      nftContract: nftContract?.toLowerCase() ?? "",
      tokenId,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
  });

  const indexerRows = useMemo(
    () => indexerOffersFromGql(gqlData?.offers),
    [gqlData?.offers],
  );

  // ── RPC fallback ──
  const rpcEnabled = enabled && !SUBGRAPH_ENABLED;

  const { data: buyersRaw, refetch: refetchBuyers } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getOfferBuyers",
    args: [nftAddr, tokenIdBn],
    query: {
      enabled: rpcEnabled,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    },
  });

  const buyerAddresses = useMemo((): readonly `0x${string}`[] => {
    if (!rpcEnabled || !buyersRaw || !Array.isArray(buyersRaw))
      return NO_OFFER_BUYERS;
    const all = buyersRaw as `0x${string}`[];
    return all.length > MAX_OFFER_BUYERS_MULTICALL
      ? all.slice(0, MAX_OFFER_BUYERS_MULTICALL)
      : all;
  }, [rpcEnabled, buyersRaw]);

  const offerReads = useMemo(
    () =>
      buyerAddresses.map((buyer) => ({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "getOffer" as const,
        args: [nftAddr, tokenIdBn, buyer] as const,
      })),
    [nftAddr, tokenIdBn, buyerAddresses],
  );

  const { data: offerRows, refetch: refetchOfferRows } = useReadContracts({
    contracts: offerReads,
    query: {
      enabled: rpcEnabled && buyerAddresses.length > 0,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    },
  });

  const rpcOffers = useMemo(() => {
    const m = buildChainOfferMap(buyerAddresses, offerRows);
    const list = [...m.values()];
    list.sort((a, b) =>
      a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1,
    );
    return list;
  }, [buyerAddresses, offerRows]);

  // ── Unified result ──
  const offers = useMemo(() => {
    const source = SUBGRAPH_ENABLED ? indexerRows : rpcOffers;
    if (!userAddress) return source;
    return source.filter((o) => o.buyerAddress.toLowerCase() !== userAddress);
  }, [indexerRows, rpcOffers, userAddress]);

  const refetch = useCallback(() => {
    if (SUBGRAPH_ENABLED) {
      gqlRefetch();
    } else {
      refetchBuyers();
      refetchOfferRows();
    }
  }, [gqlRefetch, refetchBuyers, refetchOfferRows]);

  const isLoading = SUBGRAPH_ENABLED
    ? enabled && gqlLoading && gqlData === undefined
    : enabled && buyerAddresses.length === 0 && !!nftContract;

  return {
    offers,
    isLoading,
    topOffer: offers.length > 0 ? formatEther(offers[0]!.amount) : null,
    refetch,
  };
}
