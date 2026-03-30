/**
 * useContractMutation — reusable hook for single-step contract writes.
 *
 * Eliminates the repeated pattern of:
 *   1. usePublicClient + useConnection + useWriteContract + useWaitForTransactionReceipt
 *   2. Guard for !publicClient || !address
 *   3. estimateContractGasWithBuffer → mutateAsync → track hash
 *
 * Every marketplace mutation hook (buy, cancel listing, make/cancel offer, reclaim)
 * can now be expressed as a thin wrapper around this hook.
 */
"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
  usePublicClient,
} from "wagmi";
import { useCallback } from "react";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import type { Abi, Address } from "viem";

export interface ContractCallParams {
  /** Contract address to call */
  address: Address;
  /** Contract ABI */
  abi: Abi;
  /** Function name on the ABI */
  functionName: string;
  /** Positional arguments for the function call */
  args: readonly unknown[];
  /** ETH value to send (for payable functions) */
  value?: bigint;
}

/**
 * Returns a `mutate` function that:
 *  1. Estimates gas with a safety buffer
 *  2. Sends the transaction via the connected wallet
 *  3. Tracks `isPending`, `isConfirming`, `isSuccess`, and `hash`
 *
 * @example
 * ```ts
 * const { mutate, isPending, isConfirming, isSuccess, hash } = useContractMutation();
 *
 * const buy = (contract, tokenId, price) =>
 *   mutate({
 *     address: MARKETPLACE_ADDRESS,
 *     abi: NFT_MARKETPLACE_ABI,
 *     functionName: "buyItem",
 *     args: [contract, BigInt(tokenId)],
 *     value: parseEther(price),
 *   });
 * ```
 */
export function useContractMutation() {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  const {
    data: hash,
    mutateAsync,
    isPending,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mutate = useCallback(
    async (params: ContractCallParams) => {
      if (!publicClient || !address) {
        throw new Error("No network connection.");
      }
      const gas = await estimateContractGasWithBuffer(publicClient, {
        account: address,
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        ...(params.value !== undefined ? { value: params.value } : {}),
      });
      await mutateAsync({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        ...(params.value !== undefined ? { value: params.value } : {}),
        gas,
      });
    },
    [publicClient, address, mutateAsync],
  );

  return { mutate, isPending, isConfirming, isSuccess, hash, reset };
}
