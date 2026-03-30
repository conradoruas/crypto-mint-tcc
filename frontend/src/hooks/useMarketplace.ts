"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useReadContracts,
  useConnection,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import {
  MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
  NFT_COLLECTION_ABI,
} from "@/constants/contracts";
import { GET_OFFERS_FOR_NFT } from "@/lib/graphql/queries";
import type {
  ListingData,
  OfferData,
  OfferWithBuyer,
} from "@/types/marketplace";
import { ensureAddress, parseAddress } from "@/lib/schemas";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import { useContractMutation } from "./useContractMutation";

export type { ListingData, OfferData, OfferWithBuyer };

/** Stages for approve-then-act contract flows (listing, accepting offers). */
export type TwoStepTxPhase =
  | "idle"
  | "approve-wallet"
  | "approve-confirm"
  | "exec-wallet"
  | "exec-confirm";

// ─────────────────────────────────────────────
// Hook: busca listagem e dono de um NFT
// ─────────────────────────────────────────────

export function useNFTListing(nftContract: string, tokenId: string) {
  const enabled = !!nftContract && !!tokenId;
  const nftAddr = ensureAddress(nftContract);

  const { data: listing, refetch: refetchListing } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getListing",
    args: [nftAddr, BigInt(tokenId || "0")],
    query: { enabled },
  });

  // ownerOf vem do contrato da COLEÇÃO, não do marketplace
  const { data: owner, refetch: refetchOwner } = useReadContract({
    address: nftAddr,
    abi: NFT_COLLECTION_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId || "0")],
    query: { enabled },
  });

  const refetch = useCallback(() => {
    refetchListing();
    refetchOwner();
  }, [refetchListing, refetchOwner]);

  const listingData = listing as ListingData | undefined;

  return {
    listing: listingData,
    owner,
    isListed: listingData?.active ?? false,
    price: listingData?.active ? formatEther(listingData.price) : null,
    seller: listingData?.seller,
    refetch,
  };
}

// ─────────────────────────────────────────────
// Hook: busca oferta do usuário conectado
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Hook: ofertas — subgraph first (rápido), RPC reconcilia quando possível
// ─────────────────────────────────────────────

/** Stable empty list so `useReadContracts` configs do not churn each render. */
const NO_OFFER_BUYERS: readonly `0x${string}`[] = [];

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

function mergeIndexerAndChainOffers(
  indexer: OfferWithBuyer[],
  buyersRaw: readonly `0x${string}`[] | undefined,
  chainByBuyer: Map<string, OfferWithBuyer>,
): OfferWithBuyer[] {
  const onChainBuyers = new Set((buyersRaw ?? []).map((b) => b.toLowerCase()));
  const merged = new Map<string, OfferWithBuyer>();

  for (const o of indexer) {
    const k = o.buyerAddress.toLowerCase();
    if (onChainBuyers.has(k)) {
      const c = chainByBuyer.get(k);
      if (c) merged.set(k, c);
    } else {
      merged.set(k, o);
    }
  }

  for (const [k, v] of chainByBuyer) {
    if (!merged.has(k)) merged.set(k, v);
  }

  const list = [...merged.values()];
  list.sort((a, b) =>
    a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1,
  );
  return list;
}

export function useNFTOffers(nftContract: string, tokenId: string) {
  const { address } = useConnection();
  const userAddress = address?.toLowerCase();

  const enabled = !!nftContract && !!tokenId;
  const nftAddr = ensureAddress(nftContract);
  const tokenIdBn = BigInt(tokenId || "0");

  type GqlOffersData = { offers: GqlOfferRow[] };
  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: gqlRefetch,
  } = useQuery<GqlOffersData>(GET_OFFERS_FOR_NFT, {
    skip: !enabled,
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

  const { data: buyersRaw, refetch: refetchBuyers } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getOfferBuyers",
    args: [nftAddr, tokenIdBn],
    query: {
      enabled,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    },
  });

  const buyerAddresses = useMemo((): readonly `0x${string}`[] => {
    if (!buyersRaw || !Array.isArray(buyersRaw)) return NO_OFFER_BUYERS;
    return buyersRaw as `0x${string}`[];
  }, [buyersRaw]);

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
      enabled: enabled && buyerAddresses.length > 0,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    },
  });

  const chainByBuyer = useMemo(
    () => buildChainOfferMap(buyerAddresses, offerRows),
    [buyerAddresses, offerRows],
  );

  const offers = useMemo(() => {
    const merged = mergeIndexerAndChainOffers(
      indexerRows,
      Array.isArray(buyersRaw) ? (buyersRaw as `0x${string}`[]) : undefined,
      chainByBuyer,
    );

    if (!userAddress) return merged;

    return merged.filter((o) => o.buyerAddress.toLowerCase() !== userAddress);
  }, [indexerRows, buyersRaw, chainByBuyer, userAddress]);

  const refetch = useCallback(() => {
    gqlRefetch();
    refetchBuyers();
    refetchOfferRows();
  }, [gqlRefetch, refetchBuyers, refetchOfferRows]);

  /** Spinner only on cold load (no cached indexer payload); never block on RPC. */
  const isLoading = enabled && gqlLoading && gqlData === undefined;

  return {
    offers,
    isLoading,
    topOffer: offers.length > 0 ? formatEther(offers[0]!.amount) : null,
    refetch,
  };
}

// ─────────────────────────────────────────────
// Hook: colocar NFT à venda
// ─────────────────────────────────────────────

export function useListNFT() {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  const { mutateAsync } = useWriteContract();
  const [phase, setPhase] = useState<TwoStepTxPhase>("idle");
  const inFlightRef = useRef(false);

  const listNFT = useCallback(
    async (nftContract: `0x${string}`, tokenId: string, priceInEth: string) => {
      if (inFlightRef.current) {
        throw new Error("Listing already in progress.");
      }
      if (!publicClient || !address) {
        throw new Error("No network connection.");
      }

      inFlightRef.current = true;
      try {
        setPhase("approve-wallet");
        const approveGas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: nftContract,
          abi: NFT_COLLECTION_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
        });
        const approveHash = await mutateAsync({
          address: nftContract,
          abi: NFT_COLLECTION_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
          gas: approveGas,
        });

        setPhase("approve-confirm");
        await waitForTransactionReceipt(publicClient, { hash: approveHash });

        setPhase("exec-wallet");
        const listGas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "listItem",
          args: [nftContract, BigInt(tokenId), parseEther(priceInEth)],
        });
        const listHash = await mutateAsync({
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "listItem",
          args: [nftContract, BigInt(tokenId), parseEther(priceInEth)],
          gas: listGas,
        });

        setPhase("exec-confirm");
        await waitForTransactionReceipt(publicClient, { hash: listHash });
      } finally {
        setPhase("idle");
        inFlightRef.current = false;
      }
    },
    [publicClient, address, mutateAsync],
  );

  const isFlowBusy = phase !== "idle";

  return {
    listNFT,
    /** Current step in the approve → list pipeline. */
    phase,
    /** True from first wallet prompt until the listing tx is mined. */
    isPending: isFlowBusy,
    /** True while waiting for chain confirmation (not wallet popup). */
    isConfirming: phase === "approve-confirm" || phase === "exec-confirm",
    /** @deprecated Single-hash hook was misleading for two txs; use await listNFT() success. */
    isSuccess: false,
    hash: undefined as `0x${string}` | undefined,
  };
}

// ─────────────────────────────────────────────
// Hook: comprar NFT listado
// ─────────────────────────────────────────────

export function useBuyNFT() {
  const { mutate, isPending, isConfirming, isSuccess, hash } =
    useContractMutation();

  const buyNFT = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      priceInEth: string,
    ) => {
      await mutate({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "buyItem",
        args: [nftContract, BigInt(tokenId)],
        value: parseEther(priceInEth),
      });
    },
    [mutate],
  );

  return { buyNFT, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// Hook: cancelar listagem
// ─────────────────────────────────────────────

export function useCancelListing() {
  const { mutate, isPending, isConfirming, isSuccess, hash } =
    useContractMutation();

  const cancelListing = useCallback(
    async (nftContract: `0x${string}`, tokenId: string) => {
      await mutate({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [nftContract, BigInt(tokenId)],
      });
    },
    [mutate],
  );

  return { cancelListing, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// Hook: fazer oferta
// ─────────────────────────────────────────────

export function useMakeOffer() {
  const { mutate, isPending, isConfirming, isSuccess } =
    useContractMutation();

  const makeOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      amountInEth: string,
    ) => {
      await mutate({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "makeOffer",
        args: [nftContract, BigInt(tokenId)],
        value: parseEther(amountInEth),
      });
    },
    [mutate],
  );

  return { makeOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: aceitar oferta
// ─────────────────────────────────────────────

export function useAcceptOffer() {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  const { mutateAsync } = useWriteContract();
  const [phase, setPhase] = useState<TwoStepTxPhase>("idle");
  const inFlightRef = useRef(false);

  const acceptOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      buyerAddress: `0x${string}`,
    ) => {
      if (inFlightRef.current) {
        throw new Error("Accept offer already in progress.");
      }
      if (!publicClient || !address) {
        throw new Error("No network connection.");
      }

      inFlightRef.current = true;
      try {
        setPhase("approve-wallet");
        const approveGas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: nftContract,
          abi: NFT_COLLECTION_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
        });
        const approveHash = await mutateAsync({
          address: nftContract,
          abi: NFT_COLLECTION_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
          gas: approveGas,
        });

        setPhase("approve-confirm");
        await waitForTransactionReceipt(publicClient, { hash: approveHash });

        setPhase("exec-wallet");
        const acceptGas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "acceptOffer",
          args: [nftContract, BigInt(tokenId), buyerAddress],
        });
        const acceptHash = await mutateAsync({
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "acceptOffer",
          args: [nftContract, BigInt(tokenId), buyerAddress],
          gas: acceptGas,
        });

        setPhase("exec-confirm");
        await waitForTransactionReceipt(publicClient, { hash: acceptHash });
      } finally {
        setPhase("idle");
        inFlightRef.current = false;
      }
    },
    [publicClient, address, mutateAsync],
  );

  const isFlowBusy = phase !== "idle";

  return {
    acceptOffer,
    phase,
    isPending: isFlowBusy,
    isConfirming: phase === "approve-confirm" || phase === "exec-confirm",
    /** Use completion of `await acceptOffer()` for success UX; hook no longer tracks a single hash. */
    isSuccess: false,
  };
}

// ─────────────────────────────────────────────
// Hook: cancelar oferta
// ─────────────────────────────────────────────

export function useCancelOffer() {
  const { mutate, isPending, isConfirming, isSuccess } =
    useContractMutation();

  const cancelOffer = useCallback(
    async (nftContract: `0x${string}`, tokenId: string) => {
      await mutate({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "cancelOffer",
        args: [nftContract, BigInt(tokenId)],
      });
    },
    [mutate],
  );

  return { cancelOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: resgatar oferta expirada
// ─────────────────────────────────────────────

export function useReclaimExpiredOffer() {
  const { mutate, isPending, isConfirming, isSuccess, hash } =
    useContractMutation();

  const reclaimOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      buyerAddress: `0x${string}`,
    ) => {
      await mutate({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "reclaimExpiredOffer",
        args: [nftContract, BigInt(tokenId), buyerAddress],
      });
    },
    [mutate],
  );

  return { reclaimOffer, isPending, isConfirming, isSuccess, hash };
}
