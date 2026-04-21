"use client";

import { useWriteContract, useConnection, usePublicClient } from "wagmi";
import { waitForTransactionReceipt } from "viem/actions";
import { useCallback, useRef, useState } from "react";
import type { Abi, Address, ContractFunctionArgs, ContractFunctionName } from "viem";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import type { TwoStepTxPhase } from "@/types/marketplace";

export type { TwoStepTxPhase };

export interface ApproveStep<
  TAbi extends Abi,
  TFunc extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
> {
  address: Address;
  abi: TAbi;
  functionName: TFunc;
  args: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunc>;
}

export interface ExecStep<
  TAbi extends Abi,
  TFunc extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
> {
  address: Address;
  abi: TAbi;
  functionName: TFunc;
  args: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunc>;
  value?: bigint;
}

/**
 * Reusable hook for the approve-then-execute two-step contract flow
 * (e.g. setApprovalForAll → listItem, or setApprovalForAll → acceptOffer).
 *
 * Callers supply an `approveCheckAbi` (the NFT collection ABI) and the
 * `nftContract` address; this hook checks `isApprovedForAll` using the
 * connected user's address and skips the approval tx if already approved.
 *
 * @example
 * ```ts
 * const { execute, phase } = useTwoStepContractMutation();
 *
 * await execute({
 *   nftContract,
 *   approveCheckAbi: NFT_COLLECTION_ABI,
 *   approveStep: {
 *     address: nftContract,
 *     abi: NFT_COLLECTION_ABI,
 *     functionName: "setApprovalForAll",
 *     args: [MARKETPLACE_ADDRESS, true],
 *   },
 *   execStep: {
 *     address: MARKETPLACE_ADDRESS,
 *     abi: NFT_MARKETPLACE_ABI,
 *     functionName: "listItem",
 *     args: [nftContract, BigInt(tokenId), parseEther(price)],
 *   },
 * });
 * ```
 */
export function useTwoStepContractMutation() {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  const { mutateAsync } = useWriteContract();
  const [phase, setPhase] = useState<TwoStepTxPhase>("idle");
  const [isSuccess, setIsSuccess] = useState(false);
  const inFlightRef = useRef(false);

  const execute = useCallback(
    async <
      TApproveAbi extends Abi,
      TApproveFunc extends ContractFunctionName<TApproveAbi, "nonpayable" | "payable">,
      TExecAbi extends Abi,
      TExecFunc extends ContractFunctionName<TExecAbi, "nonpayable" | "payable">,
    >(params: {
      /** The NFT collection contract — used to check isApprovedForAll */
      nftContract: Address;
      /** ABI that exposes isApprovedForAll (typically NFT_COLLECTION_ABI) */
      approveCheckAbi: Abi;
      /** The spender address passed to isApprovedForAll (typically the marketplace) */
      spender: Address;
      /** The approval transaction to send if not yet approved */
      approveStep: ApproveStep<TApproveAbi, TApproveFunc>;
      /** The main contract call to execute after approval is confirmed */
      execStep: ExecStep<TExecAbi, TExecFunc>;
      /** Label used in the in-flight guard error message */
      operationName?: string;
    }) => {
      if (inFlightRef.current) {
        throw new Error(`${params.operationName ?? "Operation"} already in progress.`);
      }
      if (!publicClient || !address) {
        throw new Error("No network connection.");
      }

      inFlightRef.current = true;
      setIsSuccess(false);
      try {
        const isApproved = await publicClient.readContract({
          address: params.nftContract,
          abi: params.approveCheckAbi,
          functionName: "isApprovedForAll",
          args: [address, params.spender],
        });

        if (!isApproved) {
          setPhase("approve-wallet");
          const approveGas = await estimateContractGasWithBuffer(publicClient, {
            account: address,
            address: params.approveStep.address,
            abi: params.approveStep.abi as Abi,
            functionName: params.approveStep.functionName,
            args: params.approveStep.args as readonly unknown[],
          });
          // wagmi's mutateAsync overloads don't accept unresolved generics — cast through Parameters.
          const approveHash = await mutateAsync({
            address: params.approveStep.address,
            abi: params.approveStep.abi as Abi,
            functionName: params.approveStep.functionName,
            args: params.approveStep.args as readonly unknown[],
            gas: approveGas,
          } as Parameters<typeof mutateAsync>[0]);

          setPhase("approve-confirm");
          await waitForTransactionReceipt(publicClient, { hash: approveHash });
        }

        setPhase("exec-wallet");
        const execGas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: params.execStep.address,
          abi: params.execStep.abi as Abi,
          functionName: params.execStep.functionName,
          args: params.execStep.args as readonly unknown[],
          ...(params.execStep.value !== undefined ? { value: params.execStep.value } : {}),
        });
        const execHash = await mutateAsync({
          address: params.execStep.address,
          abi: params.execStep.abi as Abi,
          functionName: params.execStep.functionName,
          args: params.execStep.args as readonly unknown[],
          ...(params.execStep.value !== undefined ? { value: params.execStep.value } : {}),
          gas: execGas,
        });

        setPhase("exec-confirm");
        await waitForTransactionReceipt(publicClient, { hash: execHash });
        setIsSuccess(true);
      } finally {
        setPhase("idle");
        inFlightRef.current = false;
      }
    },
    [publicClient, address, mutateAsync],
  );

  const isFlowBusy = phase !== "idle";

  return {
    execute,
    phase,
    isPending: isFlowBusy,
    isConfirming: phase === "approve-confirm" || phase === "exec-confirm",
    isSuccess,
  };
}
