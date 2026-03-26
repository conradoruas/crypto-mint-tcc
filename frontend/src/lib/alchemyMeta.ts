import type { AlchemyNFT, NFTMeta, MetaMap } from "@/types/alchemy";

export type { NFTMeta, MetaMap };

/** Fetch metadata for an explicit list of tokens. */
export async function fetchAlchemyMeta(
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
    for (const nft of data.nfts ?? [] as AlchemyNFT[]) {
      const key = `${(nft.contract?.address ?? "").toLowerCase()}-${nft.tokenId}`;
      map.set(key, {
        name: nft.name ?? `NFT #${nft.tokenId}`,
        image: nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "",
      });
    }
  } catch {
    /* ignore */
  }
  return map;
}

/**
 * Convenience wrapper for activity/profile pages: deduplicates events by
 * (nftContract, tokenId) before calling the batch endpoint.
 */
export async function fetchAlchemyMetaForEvents(
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
  return fetchAlchemyMeta(tokens);
}
