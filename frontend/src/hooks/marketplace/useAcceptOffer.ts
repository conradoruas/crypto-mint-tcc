"use client";

import { useCallback } from "react";
import {
  MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
  NFT_COLLECTION_ABI,
} from "@/constants/contracts";
import { useTwoStepContractMutation } from "@/hooks/useTwoStepContractMutation";

export function useAcceptOffer() {
  const { execute, phase, isPending, isConfirming, isSuccess } =
    useTwoStepContractMutation();

  const acceptOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      buyerAddress: `0x${string}`,
    ) => {
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Marketplace contract is not configured.");
      }
      await execute({
        nftContract,
        approveCheckAbi: NFT_COLLECTION_ABI,
        spender: MARKETPLACE_ADDRESS,
        approveStep: {
          address: nftContract,
          abi: NFT_COLLECTION_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
        },
        execStep: {
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "acceptOffer",
          args: [nftContract, BigInt(tokenId), buyerAddress],
        },
        operationName: "Accept offer",
      });
    },
    [execute],
  );

  return { acceptOffer, phase, isPending, isConfirming, isSuccess };
}
