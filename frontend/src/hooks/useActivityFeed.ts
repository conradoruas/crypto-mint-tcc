"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  formatEther,
  parseAbiItem,
  fallback,
} from "viem";
import { sepolia } from "viem/chains";
import { useCollections } from "@/hooks/useCollections";

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;

const publicClient = createPublicClient({
  chain: sepolia,
  // O fallback garante que se um nó estiver instável, o outro assume
  transport: fallback([
    http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
    http("https://rpc.ankr.com/eth_sepolia"), // RPC alternativo com bom limite de logs
    http(), // RPC público padrão do viem
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

export function useActivityFeed(
  filterContract?: string, // filtra por coleção específica
  limit = 50,
) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { collections } = useCollections();

  useEffect(() => {
    if (collections.length === 0) return;

    const fetch = async () => {
      setIsLoading(true);
      try {
        // Bloco atual para limitar o range (últimos ~7 dias ≈ 50400 blocos)
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock - BigInt(7200);

        const allEvents: ActivityEvent[] = [];

        // ─── 1. Eventos do Marketplace ───
        const [
          soldLogs,
          listedLogs,
          cancelledLogs,
          offerMadeLogs,
          offerAcceptedLogs,
          offerCancelledLogs,
        ] = await Promise.all([
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: ITEM_SOLD_ABI,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: ITEM_LISTED_ABI,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: LISTING_CANCELLED_ABI,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: OFFER_MADE_ABI,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: OFFER_ACCEPTED_ABI,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: OFFER_CANCELLED_ABI,
            fromBlock,
            toBlock: "latest",
          }),
        ]);

        // Vendas
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

        // Listagens
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

        // Listagens canceladas
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

        // Ofertas feitas
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

        // Ofertas aceitas
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

        // Ofertas canceladas
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

        // ─── 2. Eventos de Mint (por coleção) ───
        const targetCollections = filterContract
          ? collections.filter(
              (c) =>
                c.contractAddress.toLowerCase() ===
                filterContract.toLowerCase(),
            )
          : collections;

        const mintLogs = await Promise.all(
          targetCollections.map((c) =>
            publicClient
              .getLogs({
                address: c.contractAddress,
                event: NFT_MINTED_ABI,
                fromBlock,
                toBlock: "latest",
              })
              .catch(() => []),
          ),
        );

        for (let i = 0; i < targetCollections.length; i++) {
          const collection = targetCollections[i];
          for (const log of mintLogs[i]) {
            const { to, tokenId } = log.args as {
              to: string;
              tokenId: bigint;
              tokenUri: string;
            };
            allEvents.push({
              id: `mint-${log.transactionHash}-${tokenId}`,
              type: "mint",
              nftContract: collection.contractAddress,
              tokenId: tokenId.toString(),
              from: to,
              txHash: log.transactionHash ?? "",
              blockNumber: log.blockNumber ?? BigInt(0),
            });
          }
        }

        // ─── 3. Busca timestamps dos blocos únicos ───
        const uniqueBlocks = [...new Set(allEvents.map((e) => e.blockNumber))];
        const blockTimestamps = new Map<bigint, number>();

        await Promise.all(
          uniqueBlocks.map(async (blockNumber) => {
            try {
              const block = await publicClient.getBlock({ blockNumber });
              blockTimestamps.set(blockNumber, Number(block.timestamp));
            } catch {
              /* ignora */
            }
          }),
        );

        // ─── 4. Ordena por bloco mais recente ───
        const sorted = allEvents
          .map((e) => ({ ...e, timestamp: blockTimestamps.get(e.blockNumber) }))
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, limit);

        setEvents(sorted);
      } catch (error) {
        console.error("Erro ao buscar atividade:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [collections.length, filterContract, limit]);

  return { events, isLoading };
}
