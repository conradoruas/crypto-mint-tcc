import {
  MAX_METADATA_RESPONSE_BYTES,
  SAFE_IPFS_GATEWAYS,
  getSafeImageUrl,
  getSafeMetadataUrl,
  resolveIpfsUrl,
} from "@/lib/resourceSecurity";

export { getSafeImageUrl, getSafeMetadataUrl, resolveIpfsUrl };

export const IPFS_GATEWAY_COUNT = SAFE_IPFS_GATEWAYS.length;

const DEFAULT_IPFS_TIMEOUT_MS = 5_000;
const JSON_CONTENT_TYPES = [
  "application/json",
  "application/ld+json",
  "text/json",
  "text/plain",
] as const;

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string | null | undefined> {
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength) {
    const declaredBytes = Number.parseInt(contentLength, 10);
    if (!Number.isNaN(declaredBytes) && declaredBytes > maxBytes) {
      return null;
    }
  }

  if (!response.body) {
    if (typeof response.text === "function") {
      const text = await response.text();
      return new TextEncoder().encode(text).byteLength <= maxBytes ? text : null;
    }
    return undefined;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

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
  options?: { signal?: AbortSignal; timeoutMs?: number; maxBytes?: number },
): Promise<T | null> {
  if (!uri) return null;
  const url = getSafeMetadataUrl(uri);
  if (!url) return null;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_IPFS_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? MAX_METADATA_RESPONSE_BYTES;

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
    if (!res.ok) return null;

    const contentType = res.headers?.get?.("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !JSON_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))
    ) {
      return null;
    }

    // Many tests and some fetch mocks provide a response-like object with
    // `json()` but without a readable body or `text()`. Accept that shape
    // while keeping the stricter path for real browser/server responses.
    if (!("body" in res) && typeof res.json === "function") {
      return (await res.json()) as T;
    }

    const text = await readResponseTextWithLimit(res, maxBytes);
    if (text == null) {
      if (text === null) return null;
      if (typeof res.json === "function") {
        return (await res.json()) as T;
      }
      return null;
    }

    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
