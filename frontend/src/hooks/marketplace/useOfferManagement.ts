"use client";

import { useCallback } from "react";
import { parseEther } from "viem";
import { MARKETPLACE_ADDRESS, NFT_MARKETPLACE_ABI } from "@/constants/contracts";
import { useContractMutation } from "../useContractMutation";

/**
 * Hook to make an offer on an NFT.
 */
export function useMakeOffer() {
  const { mutate, isPending, isConfirming, isSuccess } =
    useContractMutation();

  const makeOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      amountInEth: string,
    ) => {
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Marketplace contract is not configured.");
      }
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

/**
 * Hook to cancel an active offer made by the user.
 */
export function useCancelOffer() {
  const { mutate, isPending, isConfirming, isSuccess } =
    useContractMutation();

  const cancelOffer = useCallback(
    async (nftContract: `0x${string}`, tokenId: string) => {
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Marketplace contract is not configured.");
      }
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

/**
 * Hook to reclaim funds from an expired offer.
 */
export function useReclaimExpiredOffer() {
  const { mutate, isPending, isConfirming, isSuccess, hash } =
    useContractMutation();

  const reclaimOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      buyerAddress: `0x${string}`,
    ) => {
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Marketplace contract is not configured.");
      }
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
