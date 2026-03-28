"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useConnection,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { useCallback } from "react";
import { useQuery } from "@apollo/client/react";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { GET_OFFERS_FOR_NFT } from "@/lib/graphql/queries";
import type {
  ListingData,
  OfferData,
  OfferWithBuyer,
} from "@/types/marketplace";
import { ensureAddress, parseAddress } from "@/lib/schemas";

// env.ts is server-only — read the NEXT_PUBLIC_ var directly on the client
const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export type { ListingData, OfferData, OfferWithBuyer };

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
// Hook: busca todas as ofertas ativas de um NFT
// ─────────────────────────────────────────────

export function useNFTOffers(nftContract: string, tokenId: string) {
  type GqlOffer = {
    id: string;
    buyer: string;
    amount: string;
    expiresAt: string;
    active: boolean;
  };
  type GqlOffersData = { offers: GqlOffer[] };

  const {
    data: gqlData,
    loading: gqlLoading,
    refetch: gqlRefetch,
  } = useQuery<GqlOffersData>(GET_OFFERS_FOR_NFT, {
    skip: !nftContract || !tokenId,
    variables: { nftContract: nftContract?.toLowerCase(), tokenId },
  });

  const refetch = useCallback(() => {
    gqlRefetch();
  }, [gqlRefetch]);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const offers: OfferWithBuyer[] = (gqlData?.offers ?? [])
    .filter((o) => o.active && BigInt(o.expiresAt) > now)
    .flatMap((o) => {
      const buyer = parseAddress(o.buyer);
      if (!buyer) return [];
      return [
        {
          buyer,
          buyerAddress: buyer,
          amount: BigInt(o.amount),
          expiresAt: BigInt(o.expiresAt),
          active: true as const,
        },
      ];
    });

  return {
    offers,
    isLoading: gqlLoading,
    topOffer: offers.length > 0 ? formatEther(offers[0].amount) : null,
    refetch,
  };
}

// ─────────────────────────────────────────────
// Hook: colocar NFT à venda
// ─────────────────────────────────────────────

export function useListNFT() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const listNFT = async (
    nftContract: `0x${string}`,
    tokenId: string,
    priceInEth: string,
  ) => {
    // Aprovação no contrato da COLEÇÃO
    await mutateAsync({
      address: nftContract,
      abi: NFT_COLLECTION_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
      gas: BigInt(100000),
    });

    // Listagem no MARKETPLACE — hash rastreado via useWaitForTransactionReceipt
    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "listItem",
      args: [nftContract, BigInt(tokenId), parseEther(priceInEth)],
      gas: BigInt(200000),
    });
  };

  return { listNFT, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// Hook: comprar NFT listado
// ─────────────────────────────────────────────

export function useBuyNFT() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const buyNFT = async (
    nftContract: `0x${string}`,
    tokenId: string,
    priceInEth: string,
  ) => {
    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "buyItem",
      args: [nftContract, BigInt(tokenId)],
      value: parseEther(priceInEth),
      gas: BigInt(300000),
    });
  };

  return { buyNFT, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// Hook: cancelar listagem
// ─────────────────────────────────────────────

export function useCancelListing() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelListing = async (nftContract: `0x${string}`, tokenId: string) => {
    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [nftContract, BigInt(tokenId)],
      gas: BigInt(100000),
    });
  };

  return { cancelListing, isPending, isConfirming, isSuccess, hash };
}

// ─────────────────────────────────────────────
// Hook: fazer oferta
// ─────────────────────────────────────────────

export function useMakeOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const makeOffer = async (
    nftContract: `0x${string}`,
    tokenId: string,
    amountInEth: string,
  ) => {
    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "makeOffer",
      args: [nftContract, BigInt(tokenId)],
      value: parseEther(amountInEth),
      gas: BigInt(200000),
    });
  };

  return { makeOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: aceitar oferta
// ─────────────────────────────────────────────

export function useAcceptOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const acceptOffer = async (
    nftContract: `0x${string}`,
    tokenId: string,
    buyerAddress: `0x${string}`,
  ) => {
    // Aprovação no contrato da COLEÇÃO
    await mutateAsync({
      address: nftContract,
      abi: NFT_COLLECTION_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
      gas: BigInt(100000),
    });

    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "acceptOffer",
      args: [nftContract, BigInt(tokenId), buyerAddress],
      gas: BigInt(300000),
    });
  };

  return { acceptOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: cancelar oferta
// ─────────────────────────────────────────────

export function useCancelOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelOffer = async (nftContract: `0x${string}`, tokenId: string) => {
    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "cancelOffer",
      args: [nftContract, BigInt(tokenId)],
      gas: BigInt(150000),
    });
  };

  return { cancelOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: resgatar oferta expirada
// ─────────────────────────────────────────────

export function useReclaimExpiredOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const reclaimOffer = async (
    nftContract: `0x${string}`,
    tokenId: string,
    buyerAddress: `0x${string}`,
  ) => {
    await mutateAsync({
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "reclaimExpiredOffer",
      args: [nftContract, BigInt(tokenId), buyerAddress],
      gas: BigInt(150000),
    });
  };

  return { reclaimOffer, isPending, isConfirming, isSuccess, hash };
}
