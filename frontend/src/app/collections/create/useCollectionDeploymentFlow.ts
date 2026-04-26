"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import {
  createUploadAuthHeaders,
  uploadImageFile,
  uploadCollectionContractMetadata,
} from "@/lib/uploadClient";
import { createCollectionSchema, getZodErrors } from "@/lib/schemas";
import type { CreateCollectionErrors } from "@/lib/schemas";
import { formatTransactionError } from "@/lib/txErrors";
import { useCreateCollection } from "@/hooks/collections";
import { useCreateCollectionV2 } from "@/hooks/collections/useCreateCollectionV2";
import { FACTORY_V2_ADDRESS } from "@/constants/contracts";
import type { CollectionFormState } from "./useCollectionForm";

type UseCollectionDeploymentFlowArgs = {
  form: CollectionFormState;
  setError: (message: string | null) => void;
  setFieldErrors: (errors: CreateCollectionErrors) => void;
};

export function useCollectionDeploymentFlow({
  form,
  setError,
  setFieldErrors,
}: UseCollectionDeploymentFlowArgs) {
  const { address, isConnected } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const getAuthHeaders = useMemo(
    () => createUploadAuthHeaders(signMessageAsync, address),
    [signMessageAsync, address],
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const uploadCoverImage = useCallback(
    async (file: File) => uploadImageFile(file, getAuthHeaders),
    [getAuthHeaders],
  );

  const deploymentV1 = useCreateCollection();
  const deploymentV2 = useCreateCollectionV2();

  const useV2 = !!FACTORY_V2_ADDRESS;
  const deployment = useV2 ? deploymentV2 : deploymentV1;

  const createCollection = useCallback(async () => {
    setError(null);

    const errors = getZodErrors(createCollectionSchema, {
      name: form.name,
      symbol: form.symbol,
      description: form.description || undefined,
      mintPrice: form.mintPrice,
    }) as CreateCollectionErrors;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!form.coverFile) {
      setError("Select a cover image.");
      return;
    }

    if (!isConnected) {
      setError("Connect your wallet.");
      return;
    }

    if (form.nfts.length === 0) {
      setError("Add at least 1 NFT to the collection.");
      return;
    }

    if (form.nfts.some((nft) => !nft.name || !nft.file)) {
      setError("All NFTs need a name and image.");
      return;
    }

    try {
      setIsUploadingCover(true);
      const coverUri = await uploadCoverImage(form.coverFile);

      if (useV2 && address) {
        // Pin the contractURI JSON (with trait schema) before deploying
        let contractUri = "";
        try {
          contractUri = await uploadCollectionContractMetadata(
            {
              collectionAddress: address,
              name: form.name,
              image: coverUri,
              description: form.description || undefined,
              traitSchema: form.traitSchema as Record<string, unknown> | undefined,
            },
            getAuthHeaders,
          );
        } catch {
          // If pinning fails, proceed with empty contractURI rather than blocking
          contractUri = "";
        }

        await deploymentV2.createCollection({
          name: form.name,
          symbol: form.symbol.toUpperCase(),
          description: form.description,
          image: coverUri,
          maxSupply: form.nfts.length,
          mintPrice: form.mintPrice,
          contractURI: contractUri,
        });
      } else {
        await deploymentV1.createCollection({
          name: form.name,
          symbol: form.symbol.toUpperCase(),
          description: form.description,
          image: coverUri,
          maxSupply: form.nfts.length,
          mintPrice: form.mintPrice,
        });
      }
    } catch (error) {
      setError(
        formatTransactionError(
          error,
          "Could not create collection. Check uploads and try again.",
        ),
      );
    } finally {
      setIsUploadingCover(false);
    }
  }, [
    address,
    deploymentV1,
    deploymentV2,
    form.coverFile,
    form.description,
    form.mintPrice,
    form.name,
    form.nfts,
    form.symbol,
    form.traitSchema,
    getAuthHeaders,
    isConnected,
    setError,
    setFieldErrors,
    uploadCoverImage,
    useV2,
  ]);

  return {
    createCollection,
    isUploadingCover,
    isCreating: deployment.isPending,
    isConfirmingCreate: deployment.isConfirming,
    collectionCreated: deployment.isSuccess,
    createHash: deployment.hash,
    isV2: useV2,
  };
}
