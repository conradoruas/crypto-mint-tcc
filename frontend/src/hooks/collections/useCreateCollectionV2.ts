"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
  usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import {
  FACTORY_V2_ADDRESS,
  NFT_COLLECTION_FACTORY_V2_ABI,
} from "@/constants/contracts";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";

export function useCreateCollectionV2() {
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
    contractURI: string;
  }) => {
    if (!publicClient || !address || !FACTORY_V2_ADDRESS) {
      throw new Error("Wallet not connected or V2 factory not configured");
    }
    const gas = await estimateContractGasWithBuffer(publicClient, {
      account: address,
      address: FACTORY_V2_ADDRESS,
      abi: NFT_COLLECTION_FACTORY_V2_ABI,
      functionName: "createCollection",
      args: [
        params.name,
        params.symbol,
        params.description,
        params.image,
        BigInt(params.maxSupply),
        parseEther(params.mintPrice),
        params.contractURI,
      ],
    });
    await mutateAsync({
      address: FACTORY_V2_ADDRESS,
      abi: NFT_COLLECTION_FACTORY_V2_ABI,
      functionName: "createCollection",
      args: [
        params.name,
        params.symbol,
        params.description,
        params.image,
        BigInt(params.maxSupply),
        parseEther(params.mintPrice),
        params.contractURI,
      ],
      gas,
    });
  };

  return {
    createCollection,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    isAvailable: !!FACTORY_V2_ADDRESS,
  };
}
