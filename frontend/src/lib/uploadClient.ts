"use client";

import { buildUploadAuthHeaders } from "@/lib/uploadAuthClient";
import { UPLOAD_API_PATHS } from "@/lib/uploadAuthMessage";

export type SignUploadMessage = (args: {
  message: string;
}) => Promise<`0x${string}`>;

export type UploadAuthHeadersFn = (
  pathname: string,
) => Promise<Record<string, string>>;

export function createUploadAuthHeaders(
  signMessageAsync: SignUploadMessage,
  address: `0x${string}` | undefined,
): UploadAuthHeadersFn {
  return async (pathname: string) => {
    if (!address) throw new Error("Wallet required");
    return buildUploadAuthHeaders(signMessageAsync, address, pathname);
  };
}

async function readUploadUri(response: Response, failureMessage: string) {
  if (!response.ok) {
    throw new Error(`${failureMessage}: ${response.status}`);
  }

  const data = (await response.json()) as { uri?: string };
  if (!data.uri) throw new Error("Invalid URI");
  return data.uri;
}

export async function uploadImageFile(
  file: File,
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
    headers: await authHeaders(UPLOAD_API_PATHS.image),
  });

  return readUploadUri(response, "Upload failed");
}

export async function uploadJsonMetadata<TPayload>(
  pathname: string,
  payload: TPayload,
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  const response = await fetch(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders(pathname)),
    },
    body: JSON.stringify(payload),
  });

  return readUploadUri(response, "Metadata upload failed");
}

export async function uploadNftMetadata(
  params: {
    name: string;
    description: string;
    imageUri: string;
    addressSuffix?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number | boolean;
      display_type?: string;
      max_value?: number;
    }>;
  },
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  const body: Record<string, unknown> = {
    name: params.name,
    description: params.description || "",
    image: params.imageUri,
    address: params.addressSuffix ?? `nft-${Date.now()}`,
  };
  if (params.attributes && params.attributes.length > 0) {
    body.attributes = params.attributes;
  }
  return uploadJsonMetadata(UPLOAD_API_PATHS.profile, body, authHeaders);
}

/**
 * Pins the collection-level contractURI JSON (name, image, trait_schema, etc.)
 * to IPFS and returns the resulting `ipfs://...` URI.
 * The URI is stored immutably on-chain in NFTCollectionV2 as `contractURI`.
 */
export async function uploadCollectionContractMetadata(
  params: {
    collectionAddress: `0x${string}`;
    name: string;
    image: string;
    description?: string;
    externalLink?: string;
    bannerImage?: string;
    traitSchema?: Record<string, unknown>;
  },
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  const body: Record<string, unknown> = {
    address: `collection-${params.collectionAddress}`,
    name: params.name,
    image: params.image,
  };
  if (params.description) body.description = params.description;
  if (params.externalLink) body.external_link = params.externalLink;
  if (params.bannerImage) body.banner_image = params.bannerImage;
  if (params.traitSchema) body.trait_schema = params.traitSchema;
  return uploadJsonMetadata(UPLOAD_API_PATHS.profile, body, authHeaders);
}
