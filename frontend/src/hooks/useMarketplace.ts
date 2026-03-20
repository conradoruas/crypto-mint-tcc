"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useConnection,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";

const CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`;

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface ListingData {
  seller: `0x${string}`;
  price: bigint;
  active: boolean;
}

export interface OfferData {
  buyer: `0x${string}`;
  amount: bigint;
  expiresAt: bigint;
  active: boolean;
}

// ─────────────────────────────────────────────
// Hook: busca listagem e dono de um NFT
// ─────────────────────────────────────────────

export function useNFTListing(tokenId: string) {
  const { data: listing, refetch: refetchListing } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getListing",
    args: [BigInt(tokenId)],
    query: { enabled: !!tokenId },
  });

  const { data: owner, refetch: refetchOwner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
    query: { enabled: !!tokenId },
  });

  const refetch = () => {
    refetchListing();
    refetchOwner();
  };

  return {
    listing: listing as ListingData | undefined,
    owner: owner as `0x${string}` | undefined,
    isListed: (listing as ListingData | undefined)?.active ?? false,
    price: (listing as ListingData | undefined)?.active
      ? formatEther((listing as ListingData).price)
      : null,
    seller: (listing as ListingData | undefined)?.seller,
    refetch,
  };
}

// ─────────────────────────────────────────────
// Hook: busca oferta do usuário conectado
// ─────────────────────────────────────────────

export function useMyOffer(tokenId: string) {
  const { address } = useConnection();

  const { data: offer, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getOffer",
    args: [
      BigInt(tokenId),
      address ?? "0x0000000000000000000000000000000000000000",
    ],
    query: { enabled: !!address && !!tokenId },
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
// Hook: colocar NFT à venda
// ─────────────────────────────────────────────

export function useListNFT() {
  const { mutateAsync, isPending } = useWriteContract();

  const listNFT = async (tokenId: string, priceInEth: string) => {
    // Passo 1: aprovar o contrato para transferir o NFT
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "setApprovalForAll",
      args: [CONTRACT_ADDRESS, true],
      gas: BigInt(100000),
    });

    // Passo 2: listar com o preço definido
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "listItem",
      args: [BigInt(tokenId), parseEther(priceInEth)],
      gas: BigInt(200000),
    });
  };

  return { listNFT, isPending };
}

// ─────────────────────────────────────────────
// Hook: comprar NFT listado
// ─────────────────────────────────────────────

export function useBuyNFT() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const buyNFT = async (tokenId: string, priceInEth: string) => {
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "buyItem",
      args: [BigInt(tokenId)],
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
  const { mutateAsync, isPending } = useWriteContract();

  const cancelListing = async (tokenId: string) => {
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [BigInt(tokenId)],
      gas: BigInt(100000),
    });
  };

  return { cancelListing, isPending };
}

// ─────────────────────────────────────────────
// Hook: fazer oferta
// ─────────────────────────────────────────────

export function useMakeOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const makeOffer = async (tokenId: string, amountInEth: string) => {
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "makeOffer",
      args: [BigInt(tokenId)],
      value: parseEther(amountInEth),
      gas: BigInt(200000),
    });
  };

  return { makeOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: aceitar oferta (dono do NFT)
// ─────────────────────────────────────────────

export function useAcceptOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const acceptOffer = async (tokenId: string, buyerAddress: `0x${string}`) => {
    // Garante aprovação antes de aceitar
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "setApprovalForAll",
      args: [CONTRACT_ADDRESS, true],
      gas: BigInt(100000),
    });

    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "acceptOffer",
      args: [BigInt(tokenId), buyerAddress],
      gas: BigInt(300000),
    });
  };

  return { acceptOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: cancelar oferta (comprador)
// ─────────────────────────────────────────────

export function useCancelOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelOffer = async (tokenId: string) => {
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "cancelOffer",
      args: [BigInt(tokenId)],
      gas: BigInt(150000),
    });
  };

  return { cancelOffer, isPending, isConfirming, isSuccess };
}

// ─────────────────────────────────────────────
// Hook: resgatar oferta expirada
// ─────────────────────────────────────────────

export function useReclaimExpiredOffer() {
  const { mutateAsync, isPending } = useWriteContract();

  const reclaimOffer = async (tokenId: string, buyerAddress: `0x${string}`) => {
    await mutateAsync({
      address: CONTRACT_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "reclaimExpiredOffer",
      args: [BigInt(tokenId), buyerAddress],
      gas: BigInt(150000),
    });
  };

  return { reclaimOffer, isPending };
}
