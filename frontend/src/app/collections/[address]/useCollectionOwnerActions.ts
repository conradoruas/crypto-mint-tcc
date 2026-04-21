"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import {
  useBalance,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { NFT_COLLECTION_ABI } from "@/abi/NFTCollection";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import { generateAndStoreMintSeed } from "@/lib/mintSeed";
import { formatTransactionError } from "@/lib/txErrors";

export function useCollectionOwnerActions(
  collectionAddress: `0x${string}`,
  userAddress: `0x${string}` | undefined,
  onMintSeedCommitted: () => void,
) {
  const publicClient = usePublicClient();
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawHash, setWithdrawHash] = useState<`0x${string}` | undefined>();
  const [commitSeedHash, setCommitSeedHash] = useState<`0x${string}` | undefined>();
  const [commitSeedError, setCommitSeedError] = useState<string | null>(null);

  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: collectionAddress,
    query: { enabled: !!collectionAddress },
  });

  const { mutateAsync: withdrawWrite, isPending: isWithdrawPending } =
    useWriteContract();
  const withdrawReceipt = useWaitForTransactionReceipt({ hash: withdrawHash });

  const { mutateAsync: commitSeedWrite, isPending: isCommitSeedPending } =
    useWriteContract();
  const commitSeedReceipt = useWaitForTransactionReceipt({ hash: commitSeedHash });

  useEffect(() => {
    if (withdrawReceipt.isSuccess) {
      setWithdrawSuccess(true);
      void refetchBalance();
    }
  }, [refetchBalance, withdrawReceipt.isSuccess]);

  useEffect(() => {
    if (commitSeedReceipt.isSuccess) {
      onMintSeedCommitted();
    }
  }, [commitSeedReceipt.isSuccess, onMintSeedCommitted]);

  const handleCommitMintSeed = async () => {
    setCommitSeedError(null);

    try {
      if (!userAddress || !publicClient) {
        throw new Error("Connect your wallet.");
      }

      const { commitment } = generateAndStoreMintSeed(collectionAddress);
      const gas = await estimateContractGasWithBuffer(publicClient, {
        account: userAddress,
        address: collectionAddress,
        abi: NFT_COLLECTION_ABI,
        functionName: "commitMintSeed",
        args: [commitment],
      });

      const hash = await commitSeedWrite({
        address: collectionAddress,
        abi: NFT_COLLECTION_ABI,
        functionName: "commitMintSeed",
        args: [commitment],
        gas,
      });

      setCommitSeedHash(hash);
    } catch (error) {
      setCommitSeedError(
        formatTransactionError(error, "Could not enable minting. Try again."),
      );
    }
  };

  const handleWithdraw = async () => {
    setWithdrawError(null);

    try {
      if (!userAddress || !publicClient) {
        throw new Error("Connect your wallet.");
      }

      const gas = await estimateContractGasWithBuffer(publicClient, {
        account: userAddress,
        address: collectionAddress,
        abi: NFT_COLLECTION_ABI,
        functionName: "withdraw",
      });

      const hash = await withdrawWrite({
        address: collectionAddress,
        abi: NFT_COLLECTION_ABI,
        functionName: "withdraw",
        gas,
      });

      setWithdrawHash(hash);
    } catch (error) {
      setWithdrawError(
        formatTransactionError(error, "Could not withdraw funds. Try again."),
      );
    }
  };

  return {
    contractBalance,
    contractBalanceEth:
      contractBalance && contractBalance.value > 0n
        ? parseFloat(formatEther(contractBalance.value)).toFixed(4)
        : null,
    withdrawError,
    setWithdrawError,
    withdrawSuccess,
    setWithdrawSuccess,
    withdrawHash,
    isWithdrawPending,
    isWithdrawConfirming: withdrawReceipt.isLoading,
    commitSeedError,
    isCommitSeedPending,
    isCommitSeedConfirming: commitSeedReceipt.isLoading,
    handleCommitMintSeed,
    handleWithdraw,
  };
}
