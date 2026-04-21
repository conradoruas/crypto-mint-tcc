"use client";

import { useCallback } from "react";
import { parseEther } from "viem";
import { MARKETPLACE_ADDRESS, NFT_MARKETPLACE_ABI } from "@/constants/contracts";
import { useContractMutation } from "../useContractMutation";

/**
 * Hook to buy a listed NFT from the marketplace.
 */
export function useBuyNFT() {
  const { mutate, isPending, isConfirming, isSuccess, hash } =
    useContractMutation();

  const buyNFT = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      priceInEth: string,
    ) => {
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Marketplace contract is not configured.");
      }
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
