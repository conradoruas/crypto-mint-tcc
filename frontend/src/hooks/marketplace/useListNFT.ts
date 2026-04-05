"use client";

import { useWriteContract, useConnection, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { useCallback, useRef, useState } from "react";
import {
  MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
  NFT_COLLECTION_ABI,
} from "@/constants/contracts";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import type { TwoStepTxPhase } from "@/types/marketplace";

/**
 * Hook to list an NFT for sale on the marketplace.
 * Handles the two-step process: Approval -> Listing.
 */
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
    phase,
    isPending: isFlowBusy,
    isConfirming: phase === "approve-confirm" || phase === "exec-confirm",
    /** @deprecated Single-hash hook was misleading for two txs; use await listNFT() success. */
    isSuccess: false,
    hash: undefined as `0x${string}` | undefined,
  };
}
