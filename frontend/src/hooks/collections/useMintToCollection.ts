"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
  usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import { NFT_COLLECTION_ABI } from "@/constants/contracts";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";

/**
 * Hook to mint a new NFT in a specific collection.
 */
export function useMintToCollection() {
  const publicClient = usePublicClient();
  const { data: hash, mutateAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const { address } = useConnection();

  const mint = async (
    collectionAddress: `0x${string}`,
    mintPriceInEth: string,
    recipientAddress?: `0x${string}`,
  ) => {
    const to = recipientAddress ?? address;
    if (!to) throw new Error("Wallet not connected");
    if (!publicClient) throw new Error("Public client not available");

    const value = parseEther(mintPriceInEth);
    const gas = await estimateContractGasWithBuffer(publicClient, {
      account: to,
      address: collectionAddress,
      abi: NFT_COLLECTION_ABI,
      functionName: "mint",
      args: [to],
      value,
    });
    await mutateAsync({
      address: collectionAddress,
      abi: NFT_COLLECTION_ABI,
      functionName: "mint",
      args: [to],
      value,
      gas,
    });
  };

  return { mint, isPending, isConfirming, isSuccess, hash };
}
