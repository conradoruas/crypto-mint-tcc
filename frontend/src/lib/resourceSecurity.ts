const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const DISALLOWED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
]);

const ALLOWED_IPFS_GATEWAY_HOSTS = [
  "ipfs.io",
  "cloudflare-ipfs.com",
  "nftstorage.link",
] as const;

const ALLOWED_IPFS_GATEWAY_SUFFIXES = [".ipfs.dweb.link"] as const;

const ALLOWED_IMAGE_HOSTS = [
  ...ALLOWED_IPFS_GATEWAY_HOSTS,
  "nft-cdn.alchemy.com",
] as const;

export const SAFE_IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
] as const;

export const MAX_METADATA_RESPONSE_BYTES = 1_000_000;

type HostPattern = readonly string[];

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

function hasAllowedHost(
  host: string,
  exactHosts: HostPattern,
  suffixHosts: HostPattern = [],
): boolean {
  const normalized = host.toLowerCase();
  return (
    exactHosts.includes(normalized) ||
    suffixHosts.some((suffix) => normalized.endsWith(suffix))
  );
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function normalizeIpfsPath(value: string): string | null {
  const trimmed = stripControlChars(value.trim());
  if (!trimmed.startsWith("ipfs://")) return null;

  const path = trimmed.slice("ipfs://".length).replace(/^\/+/, "");
  if (!path || path.length > 2048) return null;

  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function isAllowedHttpsUrl(
  value: string,
  exactHosts?: HostPattern,
  suffixHosts: HostPattern = [],
): string | null {
  const parsed = parseUrl(stripControlChars(value.trim()));
  if (!parsed) return null;
  if (DISALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (parsed.protocol !== "https:") return null;
  if (exactHosts && !hasAllowedHost(parsed.hostname, exactHosts, suffixHosts)) {
    return null;
  }
  return parsed.toString();
}

export function getSafeAssetUri(value: string): string | null {
  const raw = stripControlChars(value.trim());
  if (!raw) return null;

  const ipfsPath = normalizeIpfsPath(raw);
  if (ipfsPath) {
    return `ipfs://${decodeURIComponent(ipfsPath)}`;
  }

  return isAllowedHttpsUrl(raw);
}

export function sanitizeUntrustedText(
  value: unknown,
  {
    maxLength = 10_000,
    fallback = "",
  }: { maxLength?: number; fallback?: string } = {},
): string {
  if (typeof value !== "string") return fallback;
  const normalized = stripControlChars(value).trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

export function resolveIpfsUrl(value: string, gatewayIndex = 0): string {
  const path = normalizeIpfsPath(value);
  if (path) {
    return `${SAFE_IPFS_GATEWAYS[gatewayIndex] ?? SAFE_IPFS_GATEWAYS[0]}${path}`;
  }

  return (
    isAllowedHttpsUrl(
      value,
      ALLOWED_IMAGE_HOSTS,
      ALLOWED_IPFS_GATEWAY_SUFFIXES,
    ) ?? ""
  );
}

export function getSafeMetadataUrl(value: string): string | null {
  const ipfsPath = normalizeIpfsPath(value);
  const ipfsUrl = ipfsPath
    ? `${SAFE_IPFS_GATEWAYS[0]}${ipfsPath}`
    : null;
  if (ipfsUrl) return ipfsUrl;

  return isAllowedHttpsUrl(value);
}

export function getSafeIpfsMetadataUrl(value: string): string | null {
  const ipfsPath = normalizeIpfsPath(value);
  if (!ipfsPath) return null;
  return `${SAFE_IPFS_GATEWAYS[0]}${ipfsPath}`;
}

export function getSafeImageUrl(
  value: string,
  options?: { allowObjectUrl?: boolean },
): string | null {
  const raw = stripControlChars(value.trim());
  if (!raw) return null;
  if (options?.allowObjectUrl && raw.startsWith("blob:")) return raw;

  const ipfsUrl = resolveIpfsUrl(raw);
  if (ipfsUrl) return ipfsUrl;

  return isAllowedHttpsUrl(raw);
}

export function getAllowedImageHosts() {
  return [...ALLOWED_IMAGE_HOSTS];
}

export function getAllowedIpfsGatewayHosts() {
  return [...ALLOWED_IPFS_GATEWAY_HOSTS];
}
