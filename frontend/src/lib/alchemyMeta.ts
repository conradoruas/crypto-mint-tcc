export type NFTMeta = { name: string; image: string };

export async function fetchAlchemyMeta(
  tokens: { contractAddress: string; tokenId: string }[],
): Promise<Map<string, NFTMeta>> {
  const map = new Map<string, NFTMeta>();
  if (!tokens.length) return map;
  try {
    const res = await fetch(
      `/api/alchemy/getNFTMetadataBatch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, refreshCache: false }),
      },
    );
    const data = await res.json();
    for (const nft of data.nfts ?? []) {
      const key = `${(nft.contract?.address ?? "").toLowerCase()}-${nft.tokenId}`;
      map.set(key, {
        name: nft.name ?? `NFT #${nft.tokenId}`,
        image: nft.image?.cachedUrl ?? nft.image?.originalUrl ?? "",
      });
    }
  } catch { /* ignore */ }
  return map;
}
