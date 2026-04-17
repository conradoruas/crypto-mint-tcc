"use client";

import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { useCallback } from "react";
import {
  MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
  NFT_COLLECTION_ABI,
} from "@/constants/contracts";
import type { ListingData } from "@/types/marketplace";
import { ensureAddressOrZero } from "@/lib/schemas";

/**
 * Hook to fetch listing and owner information for a specific NFT.
 */
export function useNFTListing(nftContract: string, tokenId: string) {
  const enabled = !!nftContract && !!tokenId;
  const nftAddr = ensureAddressOrZero(nftContract);

  const { data: listing, refetch: refetchListing } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: NFT_MARKETPLACE_ABI,
    functionName: "getListing",
    args: [nftAddr, BigInt(tokenId || "0")],
    query: { enabled },
  });

  // ownerOf comes from the COLLECTION contract, not the marketplace
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
