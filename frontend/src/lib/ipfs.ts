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

const DEFAULT_IPFS_TIMEOUT_MS = 5_000;

/**
 * Fetch and parse JSON from an IPFS URI (or any HTTP URL).
 *
 * Centralises IPFS metadata fetching so every hook shares the same timeout,
 * error handling, and gateway-resolution logic instead of each reimplementing
 * its own fetch-with-catch.
 *
 * Returns `null` on any network or parse error — callers should handle the
 * null case with a fallback value.
 *
 * @param uri       An `ipfs://` URI or a plain HTTP(S) URL
 * @param signal    Optional AbortSignal for request cancellation
 * @param timeoutMs Milliseconds before the request is aborted (default 5 s)
 */
export async function fetchIpfsJson<T = Record<string, unknown>>(
  uri: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T | null> {
  if (!uri) return null;
  const url = resolveIpfsUrl(uri);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_IPFS_TIMEOUT_MS;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Merge caller's signal with our timeout signal
  const signal = options?.signal
    ? AbortSignal.any
      ? AbortSignal.any([options.signal, timeoutController.signal])
      : timeoutController.signal
    : timeoutController.signal;

  try {
    const res = await fetch(url, { signal });
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
