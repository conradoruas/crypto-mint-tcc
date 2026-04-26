"use client";

import { useCallback, useMemo } from "react";
import { useConnection, useSignMessage } from "wagmi";
import {
  createUploadAuthHeaders,
  uploadCollectionContractMetadata,
} from "@/lib/uploadClient";
import type { TraitSchema } from "@/types/traits";

export function usePublishCollectionContractUri() {
  const { address } = useConnection();
  const { signMessageAsync } = useSignMessage();

  const getAuthHeaders = useMemo(
    () => createUploadAuthHeaders(signMessageAsync, address),
    [signMessageAsync, address],
  );

  const publishContractUri = useCallback(
    async (params: {
      collectionAddress: `0x${string}`;
      name: string;
      image: string;
      description?: string;
      externalLink?: string;
      bannerImage?: string;
      traitSchema?: TraitSchema;
    }): Promise<string> => {
      if (!address) throw new Error("Wallet required");
      return uploadCollectionContractMetadata(
        {
          collectionAddress: params.collectionAddress,
          name: params.name,
          image: params.image,
          description: params.description,
          externalLink: params.externalLink,
          bannerImage: params.bannerImage,
          traitSchema: params.traitSchema as Record<string, unknown> | undefined,
        },
        getAuthHeaders,
      );
    },
    [address, getAuthHeaders],
  );

  return { publishContractUri };
}
