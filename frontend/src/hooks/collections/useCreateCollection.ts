"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
  usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import {
  FACTORY_ADDRESS,
  NFT_COLLECTION_FACTORY_ABI,
} from "@/constants/contracts";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";

/**
 * Hook to create a new NFT collection using the factory contract.
 */
export function useCreateCollection() {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  const { data: hash, mutateAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createCollection = async (params: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    maxSupply: number;
    mintPrice: string;
  }) => {
    if (!publicClient || !address) {
      throw new Error("Wallet not connected");
    }
    const gas = await estimateContractGasWithBuffer(publicClient, {
      account: address,
      address: FACTORY_ADDRESS,
      abi: NFT_COLLECTION_FACTORY_ABI,
      functionName: "createCollection",
      args: [
        params.name,
        params.symbol,
        params.description,
        params.image,
        BigInt(params.maxSupply),
        parseEther(params.mintPrice),
      ],
    });
    await mutateAsync({
      address: FACTORY_ADDRESS,
      abi: NFT_COLLECTION_FACTORY_ABI,
      functionName: "createCollection",
      args: [
        params.name,
        params.symbol,
        params.description,
        params.image,
        BigInt(params.maxSupply),
        parseEther(params.mintPrice),
      ],
      gas,
    });
  };

  return { createCollection, isPending, isConfirming, isSuccess, hash };
}
