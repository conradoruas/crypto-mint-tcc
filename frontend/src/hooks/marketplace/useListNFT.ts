"use client";

import { parseEther } from "viem";
import { useCallback } from "react";
import {
  MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
  NFT_COLLECTION_ABI,
} from "@/constants/contracts";
import { useTwoStepContractMutation } from "@/hooks/useTwoStepContractMutation";

export function useListNFT() {
  const { execute, phase, isPending, isConfirming, isSuccess } =
    useTwoStepContractMutation();

  const listNFT = useCallback(
    async (nftContract: `0x${string}`, tokenId: string, priceInEth: string) => {
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
          functionName: "listItem",
          args: [nftContract, BigInt(tokenId), parseEther(priceInEth)],
        },
        operationName: "Listing",
      });
    },
    [execute],
  );

  return { listNFT, phase, isPending, isConfirming, isSuccess };
}
