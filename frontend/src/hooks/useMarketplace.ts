"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useConnection,
} from "wagmi";
import { parseEther, formatEther, createPublicClient, http } from "viem";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { sepolia } from "viem/chains";
import { GET_OFFERS_FOR_NFT } from "@/lib/graphql/queries";

const SUBGRAPH_ENABLED = !!process.env.NEXT_PUBLIC_SUBGRAPH_URL;

// ✅ Separado: marketplace genérico tem seu próprio endereço
const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

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

export interface OfferWithBuyer extends OfferData {
  buyerAddress: `0x${string}`;
}

// ─────────────────────────────────────────────
// Hook: busca listagem e dono de um NFT
// ─────────────────────────────────────────────

export function useNFTListing(nftContract: string, tokenId: string) {
  const enabled = !!nftContract && !!tokenId;

  const { data: listing, refetch: refetchListing } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getListing",
    args: [nftContract as `0x${string}`, BigInt(tokenId || "0")],
    query: { enabled },
  });

  // ownerOf vem do contrato da COLEÇÃO, não do marketplace
  const { data: owner, refetch: refetchOwner } = useReadContract({
    address: nftContract as `0x${string}`,
    abi: NFT_COLLECTION_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId || "0")],
    query: { enabled },
  });

  const refetch = () => {
    refetchListing();
    refetchOwner();
  };

  const listingData = listing as ListingData | undefined;

  return {
    listing: listingData,
    owner: owner as `0x${string}` | undefined,
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
  const { address } = useConnection(); // ✅ corrigido

  const { data: offer, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getOffer",
    args: [
      nftContract as `0x${string}`,
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
  // ── GraphQL path ──
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
    skip: !SUBGRAPH_ENABLED || !nftContract || !tokenId,
    variables: {
      nftContract: nftContract?.toLowerCase(),
      tokenId: tokenId,
    },
  });

  // ── RPC path ──
  const [rpcOffers, setRpcOffers] = useState<OfferWithBuyer[]>([]);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcTopOffer, setRpcTopOffer] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRpcOffers = useCallback(async () => {
    if (SUBGRAPH_ENABLED || !nftContract || !tokenId || hasFetched) return;
    setRpcLoading(true);

    try {
      const buyers = (await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: NFT_MARKETPLACE_ABI,
        functionName: "getOfferBuyers",
        args: [nftContract as `0x${string}`, BigInt(tokenId)],
      })) as `0x${string}`[];

      if (buyers.length === 0) {
        setRpcOffers([]);
        setRpcTopOffer(null);
        setHasFetched(true);
        return;
      }

      const uniqueBuyers = [...new Set(buyers)];

      const offerResults = await Promise.all(
        uniqueBuyers.map(async (buyer) => {
          try {
            const offer = (await publicClient.readContract({
              address: MARKETPLACE_ADDRESS,
              abi: NFT_MARKETPLACE_ABI,
              functionName: "getOffer",
              args: [nftContract as `0x${string}`, BigInt(tokenId), buyer],
            })) as OfferData;
            return { ...offer, buyerAddress: buyer };
          } catch {
            return null;
          }
        }),
      );

      const now = BigInt(Math.floor(Date.now() / 1000));
      const activeOffers = offerResults
        .filter(
          (o): o is OfferWithBuyer =>
            o !== null && o.active && o.expiresAt > now,
        )
        .sort((a, b) => (b.amount > a.amount ? 1 : -1));

      setRpcOffers(activeOffers);
      setRpcTopOffer(
        activeOffers.length > 0 ? formatEther(activeOffers[0].amount) : null,
      );
    } catch (error) {
      console.error("Erro ao buscar ofertas:", error);
    } finally {
      setRpcLoading(false);
      setHasFetched(true);
    }
  }, [nftContract, tokenId, hasFetched]);

  useEffect(() => {
    fetchRpcOffers();
  }, [fetchRpcOffers]);

  const refetch = useCallback(() => {
    if (SUBGRAPH_ENABLED) {
      gqlRefetch();
    } else {
      setHasFetched(false);
    }
  }, [gqlRefetch]);

  if (SUBGRAPH_ENABLED) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const gqlOffers = (gqlData?.offers ?? [])
      .filter((o) => o.active && BigInt(o.expiresAt) > now)
      .map((o) => ({
        buyer: o.buyer as `0x${string}`,
        buyerAddress: o.buyer as `0x${string}`,
        amount: BigInt(o.amount),
        expiresAt: BigInt(o.expiresAt),
        active: true,
      })) as OfferWithBuyer[];

    return {
      offers: gqlOffers,
      isLoading: gqlLoading,
      topOffer: gqlOffers.length > 0 ? formatEther(gqlOffers[0].amount) : null,
      refetch,
    };
  }

  return { offers: rpcOffers, isLoading: rpcLoading, topOffer: rpcTopOffer, refetch };
}

// ─────────────────────────────────────────────
// Hook: colocar NFT à venda
// ─────────────────────────────────────────────

export function useListNFT() {
  const { mutateAsync, isPending } = useWriteContract(); // ✅ corrigido

  const listNFT = async (
    nftContract: `0x${string}`,
    tokenId: string,
    priceInEth: string,
  ) => {
    // Aprovação no contrato da COLEÇÃO
    await mutateAsync({
      // ✅ corrigido
      address: nftContract,
      abi: NFT_COLLECTION_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
      gas: BigInt(100000),
    });

    // Listagem no MARKETPLACE
    await mutateAsync({
      // ✅ corrigido
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "listItem",
      args: [nftContract, BigInt(tokenId), parseEther(priceInEth)],
      gas: BigInt(200000),
    });
  };

  return { listNFT, isPending };
}

// ─────────────────────────────────────────────
// Hook: comprar NFT listado
// ─────────────────────────────────────────────

export function useBuyNFT() {
  const { data: hash, mutateAsync, isPending } = useWriteContract(); // ✅ corrigido
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const buyNFT = async (
    nftContract: `0x${string}`,
    tokenId: string,
    priceInEth: string,
  ) => {
    await mutateAsync({
      // ✅ corrigido
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
  const { mutateAsync, isPending } = useWriteContract(); // ✅ corrigido

  const cancelListing = async (nftContract: `0x${string}`, tokenId: string) => {
    await mutateAsync({
      // ✅ corrigido
      address: MARKETPLACE_ADDRESS,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [nftContract, BigInt(tokenId)],
      gas: BigInt(100000),
    });
  };

  return { cancelListing, isPending };
}

// ─────────────────────────────────────────────
// Hook: fazer oferta
// ─────────────────────────────────────────────

export function useMakeOffer() {
  const { data: hash, mutateAsync, isPending } = useWriteContract(); // ✅ corrigido
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const makeOffer = async (
    nftContract: `0x${string}`,
    tokenId: string,
    amountInEth: string,
  ) => {
    await mutateAsync({
      // ✅ corrigido
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
  const { data: hash, mutateAsync, isPending } = useWriteContract(); // ✅ corrigido
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
      // ✅ corrigido
      address: nftContract,
      abi: NFT_COLLECTION_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
      gas: BigInt(100000),
    });

    await mutateAsync({
      // ✅ corrigido
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
  const { data: hash, mutateAsync, isPending } = useWriteContract(); // ✅ corrigido
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelOffer = async (nftContract: `0x${string}`, tokenId: string) => {
    await mutateAsync({
      // ✅ corrigido
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
  const { mutateAsync, isPending } = useWriteContract(); // ✅ corrigido

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

  return { reclaimOffer, isPending };
}
