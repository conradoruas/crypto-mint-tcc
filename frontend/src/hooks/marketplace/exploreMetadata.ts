import { formatEther } from "viem";
import { type QueryClient } from "@tanstack/react-query";
import { fetchIpfsJson } from "@/lib/ipfs";
import { normalizeNftText } from "@/lib/nftMetadata";
import { getSafeImageUrl } from "@/lib/resourceSecurity";
import type { GqlNFT, NFTItemWithMarket } from "./exploreTypes";

type IpfsMeta = { name: string; description: string; image: string };

async function fetchTokenMeta(tokenUri: string): Promise<IpfsMeta | null> {
  const json = await fetchIpfsJson<{
    name?: string;
    description?: string;
    image?: string;
  }>(tokenUri);

  if (!json) return null;

  return {
    name: normalizeNftText(json.name, "", 500),
    description: normalizeNftText(json.description, "", 10_000),
    image: getSafeImageUrl(json.image ?? "") ?? "",
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
    } satisfies NFTItemWithMarket;
  });
}
