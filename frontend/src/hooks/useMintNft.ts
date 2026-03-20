import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { NFT_MARKETPLACE_ABI } from "@/abi/NFTMarketplace";

export function useMintNFT() {
  const { data: hash, error, isPending, mutateAsync } = useWriteContract();

  const contractAddress = process.env
    .NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`;

  const mint = async (tokenUri: string) => {
    await mutateAsync({
      address: contractAddress,
      abi: NFT_MARKETPLACE_ABI,
      functionName: "mint",
      args: [tokenUri],
      value: parseEther("0.0001"),
      gas: BigInt(300000),
    });
  };

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  return { mint, isPending, isConfirming, isSuccess, error, hash, receipt };
}
