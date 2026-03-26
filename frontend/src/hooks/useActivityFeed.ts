"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  http,
  formatEther,
  parseAbiItem,
  fallback,
} from "viem";
import { sepolia } from "viem/chains";
import { useQuery } from "@apollo/client/react";
import { useCollections } from "@/hooks/useCollections";
import {
  GET_ACTIVITY_FEED,
  GET_ACTIVITY_FEED_ALL,
} from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http("/api/rpc"),
    http("https://rpc.ankr.com/eth_sepolia"),
    http("https://ethereum-sepolia-rpc.publicnode.com"),
    http("https://rpc2.sepolia.org"),
  ]),
});

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type ActivityType =
  | "sale"
  | "listing"
  | "listing_cancelled"
  | "offer"
  | "offer_accepted"
  | "offer_cancelled"
  | "mint";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  nftContract: string;
  tokenId: string;
  from: string;
  to?: string;
  priceETH?: string;
  txHash: string;
  blockNumber: bigint;
  timestamp?: number;
}

// ABIs dos eventos
const ITEM_SOLD_ABI = parseAbiItem(
  "event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price)",
);
const ITEM_LISTED_ABI = parseAbiItem(
  "event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price)",
);
const LISTING_CANCELLED_ABI = parseAbiItem(
  "event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller)",
);
const OFFER_MADE_ABI = parseAbiItem(
  "event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt)",
);
const OFFER_ACCEPTED_ABI = parseAbiItem(
  "event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 amount)",
);
const OFFER_CANCELLED_ABI = parseAbiItem(
  "event OfferCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed buyer)",
);
const NFT_MINTED_ABI = parseAbiItem(
  "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenUri)",
);

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

export function useActivityFeed(filterContract?: string, limit = 50) {
  // ── GraphQL path ──
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
      skip: !SUBGRAPH_ENABLED || !!filterContract,
      variables: { first: limit },
    },
  );

  const { data: gqlFiltered, loading: loadingFiltered } =
    useQuery<GqlActivityData>(GET_ACTIVITY_FEED, {
      skip: !SUBGRAPH_ENABLED || !filterContract,
      variables: { first: limit, nftContract: filterContract },
    });

  // ── RPC path ──
  const [rpcEvents, setRpcEvents] = useState<ActivityEvent[]>([]);
  const [rpcLoading, setRpcLoading] = useState(true);
  const { collections } = useCollections();

  // Stable key derived from collection addresses — only changes when content changes,
  // not on every render (useCollections returns a new array reference each time)
  const collectionKey = useMemo(
    () => collections.map((c) => c.contractAddress).join(","),
    [collections],
  );

  useEffect(() => {
    if (SUBGRAPH_ENABLED) return;
    // Only wait for collections when filtering by one (needed to find mint events)
    if (filterContract && !collectionKey) return;

    const fetch = async () => {
      setRpcLoading(true);
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock - BigInt(7200); // ~24h at 12s/block, within 10k block limit

        const allEvents: ActivityEvent[] = [];

        // Sequential calls to avoid burst rate limiting on free-tier RPCs
        const logParams = { address: MARKETPLACE_ADDRESS, fromBlock, toBlock: "latest" as const };
        const soldLogs = await publicClient.getLogs({ ...logParams, event: ITEM_SOLD_ABI });
        const listedLogs = await publicClient.getLogs({ ...logParams, event: ITEM_LISTED_ABI });
        const cancelledLogs = await publicClient.getLogs({ ...logParams, event: LISTING_CANCELLED_ABI });
        const offerMadeLogs = await publicClient.getLogs({ ...logParams, event: OFFER_MADE_ABI });
        const offerAcceptedLogs = await publicClient.getLogs({ ...logParams, event: OFFER_ACCEPTED_ABI });
        const offerCancelledLogs = await publicClient.getLogs({ ...logParams, event: OFFER_CANCELLED_ABI });

        for (const log of soldLogs) {
          const { nftContract, tokenId, seller, buyer, price } = log.args as {
            nftContract: string;
            tokenId: bigint;
            seller: string;
            buyer: string;
            price: bigint;
          };
          if (
            filterContract &&
            nftContract.toLowerCase() !== filterContract.toLowerCase()
          )
            continue;
          allEvents.push({
            id: `sale-${log.transactionHash}-${tokenId}`,
            type: "sale",
            nftContract,
            tokenId: tokenId.toString(),
            from: seller,
            to: buyer,
            priceETH: formatEther(price),
            txHash: log.transactionHash ?? "",
            blockNumber: log.blockNumber ?? BigInt(0),
          });
        }

        for (const log of listedLogs) {
          const { nftContract, tokenId, seller, price } = log.args as {
            nftContract: string;
            tokenId: bigint;
            seller: string;
            price: bigint;
          };
          if (
            filterContract &&
            nftContract.toLowerCase() !== filterContract.toLowerCase()
          )
            continue;
          allEvents.push({
            id: `list-${log.transactionHash}-${tokenId}`,
            type: "listing",
            nftContract,
            tokenId: tokenId.toString(),
            from: seller,
            priceETH: formatEther(price),
            txHash: log.transactionHash ?? "",
            blockNumber: log.blockNumber ?? BigInt(0),
          });
        }

        for (const log of cancelledLogs) {
          const { nftContract, tokenId, seller } = log.args as {
            nftContract: string;
            tokenId: bigint;
            seller: string;
          };
          if (
            filterContract &&
            nftContract.toLowerCase() !== filterContract.toLowerCase()
          )
            continue;
          allEvents.push({
            id: `cancel-${log.transactionHash}-${tokenId}`,
            type: "listing_cancelled",
            nftContract,
            tokenId: tokenId.toString(),
            from: seller,
            txHash: log.transactionHash ?? "",
            blockNumber: log.blockNumber ?? BigInt(0),
          });
        }

        for (const log of offerMadeLogs) {
          const { nftContract, tokenId, buyer, amount } = log.args as {
            nftContract: string;
            tokenId: bigint;
            buyer: string;
            amount: bigint;
          };
          if (
            filterContract &&
            nftContract.toLowerCase() !== filterContract.toLowerCase()
          )
            continue;
          allEvents.push({
            id: `offer-${log.transactionHash}-${tokenId}`,
            type: "offer",
            nftContract,
            tokenId: tokenId.toString(),
            from: buyer,
            priceETH: formatEther(amount),
            txHash: log.transactionHash ?? "",
            blockNumber: log.blockNumber ?? BigInt(0),
          });
        }

        for (const log of offerAcceptedLogs) {
          const { nftContract, tokenId, seller, buyer, amount } = log.args as {
            nftContract: string;
            tokenId: bigint;
            seller: string;
            buyer: string;
            amount: bigint;
          };
          if (
            filterContract &&
            nftContract.toLowerCase() !== filterContract.toLowerCase()
          )
            continue;
          allEvents.push({
            id: `offer-accepted-${log.transactionHash}-${tokenId}`,
            type: "offer_accepted",
            nftContract,
            tokenId: tokenId.toString(),
            from: seller,
            to: buyer,
            priceETH: formatEther(amount),
            txHash: log.transactionHash ?? "",
            blockNumber: log.blockNumber ?? BigInt(0),
          });
        }

        for (const log of offerCancelledLogs) {
          const { nftContract, tokenId, buyer } = log.args as {
            nftContract: string;
            tokenId: bigint;
            buyer: string;
          };
          if (
            filterContract &&
            nftContract.toLowerCase() !== filterContract.toLowerCase()
          )
            continue;
          allEvents.push({
            id: `offer-cancel-${log.transactionHash}-${tokenId}`,
            type: "offer_cancelled",
            nftContract,
            tokenId: tokenId.toString(),
            from: buyer,
            txHash: log.transactionHash ?? "",
            blockNumber: log.blockNumber ?? BigInt(0),
          });
        }

        // Mint events — only when filtering by a specific collection
        // (avoids N getLogs calls across all collections in the global feed)
        if (filterContract) {
          const targetCollection = collections.find(
            (c) =>
              c.contractAddress.toLowerCase() === filterContract.toLowerCase(),
          );
          if (targetCollection) {
            const mintLogs = await publicClient
              .getLogs({
                address: targetCollection.contractAddress,
                event: NFT_MINTED_ABI,
                fromBlock,
                toBlock: "latest",
              })
              .catch(() => []);

            for (const log of mintLogs) {
              const { to, tokenId } = log.args as {
                to: string;
                tokenId: bigint;
                tokenUri: string;
              };
              allEvents.push({
                id: `mint-${log.transactionHash}-${tokenId}`,
                type: "mint",
                nftContract: targetCollection.contractAddress,
                tokenId: tokenId.toString(),
                from: to,
                txHash: log.transactionHash ?? "",
                blockNumber: log.blockNumber ?? BigInt(0),
              });
            }
          }
        }

        // Estimate timestamps from block numbers — no extra RPC calls needed.
        // Sepolia avg block time ≈ 12s.
        const nowSeconds = Math.floor(Date.now() / 1000);
        const estimateTimestamp = (blockNumber: bigint) =>
          nowSeconds - Number(latestBlock - blockNumber) * 12;

        const sorted = allEvents
          .map((e) => ({
            ...e,
            timestamp: estimateTimestamp(e.blockNumber),
          }))
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, limit);

        setRpcEvents(sorted);
      } catch (error) {
        console.error("Erro ao buscar atividade:", error);
      } finally {
        setRpcLoading(false);
      }
    };

    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionKey, filterContract, limit]);

  if (SUBGRAPH_ENABLED) {
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

  return { events: rpcEvents, isLoading: rpcLoading };
}
