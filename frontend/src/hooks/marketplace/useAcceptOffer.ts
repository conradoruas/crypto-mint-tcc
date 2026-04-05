"use client";

import { useWriteContract, useConnection, usePublicClient } from "wagmi";
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
 * Hook to accept an offer made on an NFT belonging to the user.
 * Handles the two-step process: Approval -> Acceptance.
 */
export function useAcceptOffer() {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  const { mutateAsync } = useWriteContract();
  const [phase, setPhase] = useState<TwoStepTxPhase>("idle");
  const inFlightRef = useRef(false);

  const acceptOffer = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: string,
      buyerAddress: `0x${string}`,
    ) => {
      if (inFlightRef.current) {
        throw new Error("Accept offer already in progress.");
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
        const acceptGas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "acceptOffer",
          args: [nftContract, BigInt(tokenId), buyerAddress],
        });
        const acceptHash = await mutateAsync({
          address: MARKETPLACE_ADDRESS,
          abi: NFT_MARKETPLACE_ABI,
          functionName: "acceptOffer",
          args: [nftContract, BigInt(tokenId), buyerAddress],
          gas: acceptGas,
        });

        setPhase("exec-confirm");
        await waitForTransactionReceipt(publicClient, { hash: acceptHash });
      } finally {
        setPhase("idle");
        inFlightRef.current = false;
      }
    },
    [publicClient, address, mutateAsync],
  );

  const isFlowBusy = phase !== "idle";

  return {
    acceptOffer,
    phase,
    isPending: isFlowBusy,
    isConfirming: phase === "approve-confirm" || phase === "exec-confirm",
    /** Use completion of `await acceptOffer()` for success UX; hook no longer tracks a single hash. */
    isSuccess: false,
  };
}
