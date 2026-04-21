"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { createUploadAuthHeaders, uploadImageFile } from "@/lib/uploadClient";
import { createCollectionSchema, getZodErrors } from "@/lib/schemas";
import type { CreateCollectionErrors } from "@/lib/schemas";
import { formatTransactionError } from "@/lib/txErrors";
import { useCreateCollection } from "@/hooks/collections";
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

  const deployment = useCreateCollection();

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
      await deployment.createCollection({
        name: form.name,
        symbol: form.symbol.toUpperCase(),
        description: form.description,
        image: coverUri,
        maxSupply: form.nfts.length,
        mintPrice: form.mintPrice,
      });
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
    deployment,
    form.coverFile,
    form.description,
    form.mintPrice,
    form.name,
    form.nfts,
    form.symbol,
    isConnected,
    setError,
    setFieldErrors,
    uploadCoverImage,
  ]);

  return {
    createCollection,
    isUploadingCover,
    isCreating: deployment.isPending,
    isConfirmingCreate: deployment.isConfirming,
    collectionCreated: deployment.isSuccess,
    createHash: deployment.hash,
  };
}
