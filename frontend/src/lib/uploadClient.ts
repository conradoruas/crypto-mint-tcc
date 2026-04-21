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
  },
  authHeaders: UploadAuthHeadersFn,
): Promise<string> {
  return uploadJsonMetadata(
    UPLOAD_API_PATHS.profile,
    {
      name: params.name,
      description: params.description || "",
      image: params.imageUri,
      address: params.addressSuffix ?? `nft-${Date.now()}`,
    },
    authHeaders,
  );
}
