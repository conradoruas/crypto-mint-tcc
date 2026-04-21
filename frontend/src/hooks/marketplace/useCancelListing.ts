"use client";

import { useCallback } from "react";
import { MARKETPLACE_ADDRESS, NFT_MARKETPLACE_ABI } from "@/constants/contracts";
import { useContractMutation } from "../useContractMutation";

/**
 * Hook to cancel an active NFT listing.
 */
export function useCancelListing() {
  const { mutate, isPending, isConfirming, isSuccess, hash } =
    useContractMutation();

  const cancelListing = useCallback(
    async (nftContract: `0x${string}`, tokenId: string) => {
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Marketplace contract is not configured.");
      }
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
