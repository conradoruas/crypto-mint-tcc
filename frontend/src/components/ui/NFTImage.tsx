"use client";

import Image from "next/image";
import { useState } from "react";
import { IPFS_GATEWAY_COUNT, getSafeImageUrl, resolveIpfsUrl } from "@/lib/ipfs";

type NFTImageProps = Omit<React.ComponentProps<typeof Image>, "src" | "onError"> & {
  src: string;
  fallback?: React.ReactNode;
};

/**
 * Drop-in replacement for next/image that cycles through IPFS gateways on error.
 * Falls back to `fallback` node (or nothing) after all gateways are exhausted.
 */
export function NFTImage({ src, fallback, alt, ...props }: NFTImageProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (gatewayIndex + 1 < IPFS_GATEWAY_COUNT) {
      setGatewayIndex((i) => i + 1);
    } else {
      setFailed(true);
    }
  };

  if (failed || !src) {
    return fallback ? <>{fallback}</> : null;
  }

  const resolved = src.startsWith("ipfs://")
    ? resolveIpfsUrl(src, gatewayIndex)
    : getSafeImageUrl(src);

  if (!resolved) {
    return fallback ? <>{fallback}</> : null;
  }

  return <Image src={resolved} alt={alt} onError={handleError} {...props} />;
}
