import { formatEther } from "viem";
import { type QueryClient } from "@tanstack/react-query";
import { fetchIpfsJson } from "@/lib/ipfs";
import { normalizeNftText } from "@/lib/nftMetadata";
import { getSafeImageUrl } from "@/lib/resourceSecurity";
import type { NftAttribute } from "@/types/traits";
import type { GqlNFT, NFTItemWithMarket } from "./exploreTypes";

type IpfsMeta = {
  name: string;
  description: string;
  image: string;
  attributes?: NftAttribute[];
};

function normalizeAttributes(
  rawAttrs:
    | Array<{
        trait_type?: string;
        value?: string | number | boolean;
        display_type?: string;
      }>
    | undefined,
): NftAttribute[] | undefined {
  const attributes = rawAttrs?.flatMap((attr) =>
    attr.trait_type && attr.value != null
      ? [{
          trait_type: attr.trait_type,
          value: attr.value,
          display_type: attr.display_type,
        }]
      : [],
  );

  return attributes && attributes.length > 0 ? attributes : undefined;
}

async function fetchTokenMeta(tokenUri: string): Promise<IpfsMeta | null> {
  const json = await fetchIpfsJson<{
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type?: string; value?: string | number | boolean; display_type?: string }>;
  }>(tokenUri);

  if (!json) return null;

  const attributes = normalizeAttributes(json.attributes);

  return {
    name: normalizeNftText(json.name, "", 500),
    description: normalizeNftText(json.description, "", 10_000),
    image: getSafeImageUrl(json.image ?? "") ?? "",
    attributes,
  };
}

const IPFS_QUERY_KEY = (uri: string) => ["ipfs-meta", uri] as const;

export async function resolveExploreNftMetadata(
  nfts: GqlNFT[],
  queryClient: QueryClient,
  collectionAddress?: string,
) {
  const metaResults = await Promise.all(
    nfts.map((nft) =>
      queryClient.fetchQuery({
        queryKey: IPFS_QUERY_KEY(nft.tokenUri ?? ""),
        queryFn: () => fetchTokenMeta(nft.tokenUri ?? ""),
        staleTime: Infinity,
      }),
    ),
  );

  return nfts.map((nft, index) => {
    const meta = metaResults[index];
    const now = Math.floor(Date.now() / 1000);
    const activeListing = nft.listing?.active ? nft.listing : null;
    const topOfferRaw = (nft.offers ?? []).find(
      (offer) => !offer.expiresAt || BigInt(offer.expiresAt) > BigInt(now),
    )?.amount;

    // Prefer subgraph-indexed attributes; fall back to IPFS JSON when File DS hasn't run yet.
    const subgraphAttrs = (nft.attributes ?? [])
      .filter((a) => a.valueStr != null || a.valueNum != null)
      .map((a) => ({
        trait_type: a.traitType,
        value: a.valueNum != null ? Number(a.valueNum) : (a.valueStr ?? ""),
        display_type: a.displayType ?? undefined,
      }));
    const resolvedAttributes =
      subgraphAttrs.length > 0 ? subgraphAttrs : (meta?.attributes ?? undefined);

    return {
      tokenId: nft.tokenId,
      name: meta?.name || `NFT #${nft.tokenId}`,
      description: meta?.description ?? "",
      image: meta?.image ?? "",
      nftContract: nft.collection?.contractAddress ?? collectionAddress ?? "",
      listingPrice: activeListing ? formatEther(BigInt(activeListing.price)) : null,
      topOffer: topOfferRaw ? formatEther(BigInt(topOfferRaw)) : null,
      collectionName: nft.collection?.name ?? "",
      seller: activeListing?.seller ?? null,
      attributes: resolvedAttributes,
    } satisfies NFTItemWithMarket;
  });
}
