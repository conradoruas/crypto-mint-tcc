/**
 * Resolves an IPFS URI to a public HTTP gateway URL.
 * Passthrough for URLs that are already HTTP(S).
 */
export const resolveIpfsUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("ipfs://"))
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  return url;
};
