"use client";

import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { NFT_COLLECTION_ABI } from "@/constants/contracts";
import { ensureAddress } from "@/lib/schemas";

/**
 * Hook to fetch detailed metadata and on-chain state for a specific NFT collection.
 */
export function useCollectionDetails(collectionAddress: string | undefined) {
  const enabled = !!collectionAddress;
  const addr = ensureAddress(collectionAddress);

  const base = {
    address: addr,
    abi: NFT_COLLECTION_ABI,
    query: { enabled },
  } as const;

  const { data: name } = useReadContract({ ...base, functionName: "name" });
  const { data: symbol } = useReadContract({ ...base, functionName: "symbol" });
  const { data: owner } = useReadContract({ ...base, functionName: "owner" });
  const { data: mintPrice } = useReadContract({
    ...base,
    functionName: "mintPrice",
  });
  const { data: maxSupply } = useReadContract({
    ...base,
    functionName: "maxSupply",
  });
  const { data: totalSupply } = useReadContract({
    ...base,
    functionName: "totalSupply",
  });

  const { data: description } = useReadContract({
    address: addr,
    abi: NFT_COLLECTION_ABI,
    functionName: "collectionDescription",
    query: { enabled },
  });

  const { data: image } = useReadContract({
    address: addr,
    abi: NFT_COLLECTION_ABI,
    functionName: "collectionImage",
    query: { enabled },
  });

  return {
    name: name as string | undefined,
    symbol: symbol as string | undefined,
    description: description as string | undefined,
    image: image as string | undefined,
    mintPrice: mintPrice as bigint | undefined,
    mintPriceEth: mintPrice ? formatEther(mintPrice as bigint) : null,
    maxSupply: maxSupply as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    owner: ensureAddress(owner),
  };
}
