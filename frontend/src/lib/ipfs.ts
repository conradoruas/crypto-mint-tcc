const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
] as const;

export const IPFS_GATEWAY_COUNT = IPFS_GATEWAYS.length;

/**
 * Resolves an IPFS URI to a public HTTP gateway URL.
 * Passthrough for URLs that are already HTTP(S).
 * Pass gatewayIndex > 0 to use a fallback gateway (e.g. on image load error).
 */
export const resolveIpfsUrl = (url: string, gatewayIndex = 0): string => {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    const cid = url.slice("ipfs://".length);
    return (IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0]) + cid;
  }
  return url;
};
