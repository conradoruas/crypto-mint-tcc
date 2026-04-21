"use client";

import { useCallback, useMemo, useState } from "react";
import pLimit from "p-limit";
import {
  useConnection,
  usePublicClient,
  useSignMessage,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { NFT_COLLECTION_ABI } from "@/constants/contracts";
import { estimateContractGasWithBuffer } from "@/lib/estimateContractGas";
import {
  createUploadAuthHeaders,
  uploadImageFile,
  uploadNftMetadata,
} from "@/lib/uploadClient";

export type PublishableNftDraft = {
  name: string;
  description: string;
  file: File | null;
};

type PublishCollectionUrisArgs = {
  collectionAddress: `0x${string}`;
  drafts: PublishableNftDraft[];
  chunkLoadSize?: number;
  uploadConcurrency?: number;
};

export function usePublishCollectionUris() {
  const { address } = useConnection();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();
  const { mutateAsync, isPending: isWalletPending } = useWriteContract();
  const [progress, setProgress] = useState(0);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isUploading, setIsUploading] = useState(false);

  const getAuthHeaders = useMemo(
    () => createUploadAuthHeaders(signMessageAsync, address),
    [signMessageAsync, address],
  );

  const uploadImage = useCallback(
    async (file: File) => uploadImageFile(file, getAuthHeaders),
    [getAuthHeaders],
  );

  const uploadMetadata = useCallback(
    async (name: string, description: string, imageUri: string) =>
      uploadNftMetadata({ name, description, imageUri }, getAuthHeaders),
    [getAuthHeaders],
  );

  const publishUris = useCallback(
    async ({
      collectionAddress,
      drafts,
      chunkLoadSize = 200,
      uploadConcurrency = 5,
    }: PublishCollectionUrisArgs) => {
      if (!address || !publicClient) {
        throw new Error("Connect your wallet.");
      }

      if (drafts.length === 0) {
        throw new Error("No NFT metadata URIs to load.");
      }

      setProgress(0);
      setIsUploading(true);

      try {
        const limit = pLimit(uploadConcurrency);
        let completed = 0;

        const uris = await Promise.all(
          drafts.map((draft) =>
            limit(async () => {
              if (!draft.file) {
                throw new Error(`NFT "${draft.name}" is missing an image file`);
              }

              const imageUri = await uploadImage(draft.file);
              const metadataUri = await uploadMetadata(
                draft.name,
                draft.description,
                imageUri,
              );

              completed += 1;
              setProgress(Math.round((completed / drafts.length) * 90));
              return metadataUri;
            }),
          ),
        );

        setProgress(95);
        setIsUploading(false);

        let lastHash: `0x${string}` | undefined;
        for (let index = 0; index < uris.length; index += chunkLoadSize) {
          const chunk = uris.slice(index, index + chunkLoadSize);
          const functionName =
            index === 0 && chunk.length === uris.length
              ? "loadTokenURIs"
              : index === 0
                ? "loadTokenURIs"
                : "appendTokenURIs";

          const gas = await estimateContractGasWithBuffer(publicClient, {
            account: address,
            address: collectionAddress,
            abi: NFT_COLLECTION_ABI,
            functionName,
            args: [chunk],
          });

          lastHash = await mutateAsync({
            address: collectionAddress,
            abi: NFT_COLLECTION_ABI,
            functionName,
            args: [chunk],
            gas,
          });

          setProgress(
            95 + Math.round(((index + chunk.length) / uris.length) * 5),
          );
        }

        setTxHash(lastHash);
        setProgress(100);
        return lastHash;
      } finally {
        setIsUploading(false);
      }
    },
    [address, mutateAsync, publicClient, uploadImage, uploadMetadata],
  );

  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  return {
    publishUris,
    progress,
    txHash,
    isUploading,
    isWalletPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
  };
}
