"use client";

import { useCallback, useState } from "react";
import { keccak256 } from "viem";
import {
  useConnection,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { NFT_COLLECTION_ABI } from "@/constants/contracts";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import { formatTransactionError } from "@/lib/txErrors";

export function useSeedCommitmentFlow(setError: (error: string | null) => void) {
  const { address } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync } = useWriteContract();
  const [generatedSeed, setGeneratedSeed] = useState<`0x${string}` | null>(
    null,
  );
  const [seedCopied, setSeedCopied] = useState(false);
  const [isCommittingSeed, setIsCommittingSeed] = useState(false);
  const [commitSeedHash, setCommitSeedHash] = useState<`0x${string}` | undefined>();

  const receipt = useWaitForTransactionReceipt({ hash: commitSeedHash });

  const commitSeed = useCallback(
    async (collectionAddress: `0x${string}`) => {
      setError(null);

      if (!address || !publicClient) {
        setError("Connect your wallet.");
        return;
      }

      try {
        setIsCommittingSeed(true);
        const seedBytes = crypto.getRandomValues(new Uint8Array(32));
        const seed = `0x${Array.from(seedBytes)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")}` as `0x${string}`;
        const commitment = keccak256(seed);

        setGeneratedSeed(seed);

        const gas = await estimateContractGasWithBuffer(publicClient, {
          account: address,
          address: collectionAddress,
          abi: NFT_COLLECTION_ABI,
          functionName: "commitMintSeed",
          args: [commitment],
        });

        const hash = await mutateAsync({
          address: collectionAddress,
          abi: NFT_COLLECTION_ABI,
          functionName: "commitMintSeed",
          args: [commitment],
          gas,
        });

        setCommitSeedHash(hash);
      } catch (error) {
        setGeneratedSeed(null);
        setError(
          formatTransactionError(
            error,
            "Could not commit mint seed. Try again.",
          ),
        );
      } finally {
        setIsCommittingSeed(false);
      }
    },
    [address, mutateAsync, publicClient, setError],
  );

  const downloadSeed = useCallback(() => {
    if (!generatedSeed) {
      return;
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            seed: generatedSeed,
            commitment: keccak256(generatedSeed),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mint-seed.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [generatedSeed]);

  const copySeed = useCallback(async () => {
    if (!generatedSeed) {
      return;
    }

    await navigator.clipboard.writeText(generatedSeed);
    setSeedCopied(true);
    window.setTimeout(() => setSeedCopied(false), 2_000);
  }, [generatedSeed]);

  return {
    commitSeed,
    downloadSeed,
    copySeed,
    generatedSeed,
    seedCopied,
    isCommittingSeed,
    commitSeedHash,
    isConfirmingSeed: receipt.isLoading,
    seedCommitted: receipt.isSuccess,
  };
}
