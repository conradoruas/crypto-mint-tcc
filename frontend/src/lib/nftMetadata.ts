/**
 * Fetches NFT metadata from the Alchemy collection endpoint.
 *
 * Previously duplicated inside `useExploreNfts.ts` as `fetchAlchemyMetadata`
 * and inside `alchemyMeta.ts` as `fetchAlchemyMeta` (batch endpoint).
 * This module consolidates all Alchemy metadata fetching into one place.
 */

import { fetchIpfsJson } from "@/lib/ipfs";
import type { AlchemyNFT, NFTMeta, MetaMap } from "@/types/alchemy";
import {
  getSafeAssetUri,
  getSafeImageUrl,
  getSafeIpfsMetadataUrl,
  sanitizeUntrustedText,
} from "@/lib/resourceSecurity";

export type { NFTMeta, MetaMap };

/** Extended metadata shape returned by the collection endpoint. */
export interface NFTMetaExtended {
  name: string;
  description: string;
  image: string;
}

type AlchemyImageShape = { cachedUrl?: string; originalUrl?: string } | undefined;

export async function resolveNftImage(
  image: AlchemyImageShape,
  tokenUri: string | null | undefined,
  options?: { signal?: AbortSignal; ipfsOnlyTokenUri?: boolean },
) {
  const directImage = getSafeImageUrl(image?.cachedUrl ?? image?.originalUrl ?? "");
  if (directImage) return directImage;
  if (!tokenUri) return "";

  const safeTokenUri = options?.ipfsOnlyTokenUri
    ? getSafeIpfsMetadataUrl(tokenUri)
    : tokenUri;
  if (!safeTokenUri) return "";

  const meta = await fetchIpfsJson<{ image?: string }>(safeTokenUri, {
    signal: options?.signal,
  });
  return getSafeImageUrl(meta?.image ?? "") ?? "";
}

export function normalizeNftText(value: unknown, fallback: string, maxLength: number) {
  return sanitizeUntrustedText(value, { maxLength, fallback });
}

// ── Collection endpoint (all NFTs for a contract) ────────────────────────────

/**
 * Fetch ALL NFT metadata for a given contract via the
 * `/api/alchemy/getNFTsForContract` proxy route.
 *
 * Falls back to fetching individual tokenURIs via IPFS when
 * Alchemy's cached images are unavailable.
 */
export async function fetchContractNFTMetadata(
  contractAddress: string,
): Promise<Map<string, NFTMetaExtended>> {
  const map = new Map<string, NFTMetaExtended>();
  try {
    const res = await fetch(
      `/api/alchemy/getNFTsForContract?contractAddress=${contractAddress}&withMetadata=true&refreshCache=false`,
    );
    const data = await res.json();
    for (const nft of data.nfts ?? []) {
      const image = await resolveNftImage(nft.image, nft.tokenUri);
      map.set(nft.tokenId, {
        name: normalizeNftText(nft.name, `NFT #${nft.tokenId}`, 500),
        description: normalizeNftText(nft.description, "", 10_000),
        image,
      });
    }
  } catch {
    /* Silently fail — UI falls back to subgraph tokenUri */
  }
  return map;
}

// ── Batch endpoint (explicit list of tokens) ─────────────────────────────────

/**
 * Fetch metadata for a specific list of tokens via the
 * `/api/alchemy/getNFTMetadataBatch` proxy route.
 */
export async function fetchBatchNFTMetadata(
  tokens: { contractAddress: string; tokenId: string }[],
): Promise<MetaMap> {
  const map: MetaMap = new Map();
  if (!tokens.length) return map;
  try {
    const res = await fetch(`/api/alchemy/getNFTMetadataBatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens, refreshCache: false }),
    });
    const data = await res.json();
    for (const nft of (data.nfts ?? []) as AlchemyNFT[]) {
      const key = `${(nft.contract?.address ?? "").toLowerCase()}-${nft.tokenId}`;
      map.set(key, {
        name: normalizeNftText(nft.name, `NFT #${nft.tokenId}`, 500),
        image: getSafeAssetUri(nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "") ?? "",
      });
    }
  } catch {
    /* ignore */
  }
  return map;
}

/**
 * Convenience wrapper: deduplicates events by (nftContract, tokenId) before
 * calling the batch endpoint. Used by activity/profile pages.
 */
export async function fetchBatchNFTMetadataForEvents(
  events: { nftContract: string; tokenId: string }[],
): Promise<MetaMap> {
  const seen = new Set<string>();
  const tokens: { contractAddress: string; tokenId: string }[] = [];
  for (const e of events) {
    const key = `${e.nftContract.toLowerCase()}-${e.tokenId}`;
    if (!seen.has(key)) {
      seen.add(key);
      tokens.push({ contractAddress: e.nftContract, tokenId: e.tokenId });
    }
  }
  return fetchBatchNFTMetadata(tokens);
}
