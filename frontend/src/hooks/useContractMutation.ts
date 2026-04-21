"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
  usePublicClient,
} from "wagmi";
import { useCallback } from "react";
import type { Abi, Address, ContractFunctionArgs, ContractFunctionName } from "viem";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";

export interface ContractCallParams<
  TAbi extends Abi = Abi,
  TFunc extends ContractFunctionName<TAbi, "nonpayable" | "payable"> = ContractFunctionName<
    TAbi,
    "nonpayable" | "payable"
  >,
> {
  /** Contract address to call */
  address: Address;
  /** Contract ABI — must be a const-asserted value for type inference to work */
  abi: TAbi;
  /** Function name on the ABI (type-checked against the ABI) */
  functionName: TFunc;
  /** Positional arguments (types inferred from ABI) */
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunc>;
  /** ETH value to send (for payable functions) */
  value?: bigint;
}

/**
 * Reusable hook for single-step contract writes.
 *
 * The `mutate` function is generic — passing a const-asserted ABI gives
 * compile-time argument checking:
 *
 * @example
 * ```ts
 * const { mutate } = useContractMutation();
 * await mutate({
 *   address: MARKETPLACE_ADDRESS,
 *   abi: NFT_MARKETPLACE_ABI,   // must be `as const`
 *   functionName: "buyItem",     // type-checked
 *   args: [contract, BigInt(tokenId)], // tuple type inferred from ABI
 *   value: parseEther(price),
 * });
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
    async <
      TAbi extends Abi,
      TFunc extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
    >(
      params: ContractCallParams<TAbi, TFunc>,
    ) => {
      if (!publicClient || !address) {
        throw new Error("No network connection.");
      }
      const gas = await estimateContractGasWithBuffer(publicClient, {
        account: address,
        address: params.address,
        abi: params.abi as Abi,
        functionName: params.functionName,
        args: params.args as readonly unknown[],
        ...(params.value !== undefined ? { value: params.value } : {}),
      });
      // wagmi's mutateAsync has overloaded generics that don't accept unresolved
      // type parameters — cast through Parameters to preserve runtime correctness.
      await mutateAsync({
        address: params.address,
        abi: params.abi as Abi,
        functionName: params.functionName,
        args: params.args as readonly unknown[],
        ...(params.value !== undefined ? { value: params.value } : {}),
        gas,
      } as Parameters<typeof mutateAsync>[0]);
    },
    [publicClient, address, mutateAsync],
  );

  return { mutate, isPending, isConfirming, isSuccess, hash, reset };
}
