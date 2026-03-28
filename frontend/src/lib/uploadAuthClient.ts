"use client";

import { buildUploadAuthMessage } from "@/lib/uploadAuthMessage";

/** Headers to attach to `fetch` for multipart (do not set Content-Type). */
export async function buildUploadAuthHeaders(
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>,
  address: `0x${string}`,
  pathname: string,
): Promise<Record<string, string>> {
  const ts = Math.floor(Date.now() / 1000);
  const message = buildUploadAuthMessage(pathname, ts);
  const signature = await signMessageAsync({ message });
  return {
    "X-CryptoMint-Address": address,
    "X-CryptoMint-Timestamp": String(ts),
    "X-CryptoMint-Signature": signature,
  };
}
