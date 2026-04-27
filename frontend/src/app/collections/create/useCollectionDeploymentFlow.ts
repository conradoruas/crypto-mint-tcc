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
import { attributesForSchema, traitSchemaSchema } from "@/lib/traitSchema";
import { useCreateCollection } from "@/hooks/collections";
import { useCreateCollectionV2 } from "@/hooks/collections/useCreateCollectionV2";
import { FACTORY_V2_ADDRESS } from "@/constants/contracts";
import type { TraitSchema } from "@/types/traits";
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

    let validatedTraitSchema: TraitSchema | undefined;
    if (form.traitSchema) {
      if (!useV2) {
        setError("Trait schemas require the V2 collection factory configuration.");
        return;
      }
      const parsedSchema = traitSchemaSchema.safeParse(form.traitSchema);
      if (!parsedSchema.success) {
        setError(parsedSchema.error.issues[0]?.message ?? "Trait schema is invalid.");
        return;
      }
      validatedTraitSchema = parsedSchema.data;

      const validateAttributes = attributesForSchema(validatedTraitSchema);
      for (const nft of form.nfts) {
        const parsedAttributes = validateAttributes.safeParse(nft.attributes ?? []);
        if (!parsedAttributes.success) {
          setError(
            `NFT "${nft.name}" has invalid traits: ${parsedAttributes.error.issues[0]?.message ?? "Invalid attribute set."}`,
          );
          return;
        }
      }
    } else if (form.nfts.some((nft) => (nft.attributes?.length ?? 0) > 0)) {
      setError("Define a trait schema before assigning NFT traits.");
      return;
    }

    try {
      setIsUploadingCover(true);
      const coverUri = await uploadCoverImage(form.coverFile);

      if (useV2 && address) {
        // Pin the contractURI JSON (with trait schema) before deploying
        let contractUri = "";
        if (validatedTraitSchema) {
          try {
            contractUri = await uploadCollectionContractMetadata(
              {
                collectionAddress: address,
                name: form.name,
                image: coverUri,
                description: form.description || undefined,
                traitSchema: validatedTraitSchema as unknown as Record<string, unknown>,
              },
              getAuthHeaders,
            );
          } catch (error) {
            setError(
              formatTransactionError(
                error,
                "Could not upload collection trait schema metadata. Fix the upload error and try again.",
              ),
            );
            return;
          }
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
