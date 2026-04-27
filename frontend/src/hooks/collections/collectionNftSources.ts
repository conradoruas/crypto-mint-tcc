"use client";

import { apolloClient } from "@/lib/apolloClient";
import { GET_COLLECTION_WITH_NFTS } from "@/lib/graphql/queries";
import { fetchIpfsJson } from "@/lib/ipfs";
import { normalizeNftText, resolveNftImage } from "@/lib/nftMetadata";
import { getSafeImageUrl } from "@/lib/resourceSecurity";
import type { AlchemyNFT } from "@/types/alchemy";
import type { CollectionNFTItem } from "@/types/nft";

export const COLLECTION_NFT_PAGE_SIZE = 20;

import type { NftAttribute } from "@/types/traits";

type GqlNFT = { tokenId: string; tokenUri?: string };

type TokenMeta = {
  name: string;
  description: string;
  image: string;
  attributes?: NftAttribute[];
};

async function resolveTokenMeta(tokenUri: string): Promise<TokenMeta | null> {
  const json = await fetchIpfsJson<{
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type?: string; value?: string | number | boolean; display_type?: string }>;
  }>(tokenUri);

  if (!json) return null;

  const rawAttrs = json.attributes;
  const attributes = rawAttrs
    ?.filter((a) => a.trait_type && a.value != null)
    .map((a) => ({
      trait_type: a.trait_type!,
      value: a.value as string | number | boolean,
      display_type: a.display_type,
    }));

  return {
    name: normalizeNftText(json.name, "", 500),
    description: normalizeNftText(json.description, "", 10_000),
    image: getSafeImageUrl(json.image ?? "") ?? "",
    attributes: attributes && attributes.length > 0 ? attributes : undefined,
  };
}

function mapCollectionNft(
  collectionAddress: string,
  tokenId: string,
  meta?: TokenMeta | null,
): CollectionNFTItem {
  return {
    tokenId,
    name: meta?.name || `NFT #${tokenId}`,
    description: meta?.description ?? "",
    image: meta?.image ?? "",
    nftContract: collectionAddress,
    attributes: meta?.attributes,
  };
}

export async function fetchCollectionNftsFromSubgraph(
  collectionAddress: string,
  skip: number,
) {
  const { data } = await apolloClient.query<{
    collection: { totalSupply: string } | null;
    nfts: GqlNFT[];
  }>({
    query: GET_COLLECTION_WITH_NFTS,
    variables: {
      id: collectionAddress.toLowerCase(),
      first: COLLECTION_NFT_PAGE_SIZE + 1,
      skip,
    },
    fetchPolicy: "network-only",
  });

  const rawNfts = data?.nfts ?? [];
  const hasMore = rawNfts.length > COLLECTION_NFT_PAGE_SIZE;
  const pageItems = hasMore
    ? rawNfts.slice(0, COLLECTION_NFT_PAGE_SIZE)
    : rawNfts;
  const metaResults = await Promise.all(
    pageItems.map((nft) => resolveTokenMeta(nft.tokenUri ?? "")),
  );

  return {
    items: pageItems.map((nft, index) =>
      mapCollectionNft(collectionAddress, nft.tokenId, metaResults[index]),
    ),
    totalCount: Number(data?.collection?.totalSupply ?? 0),
    hasMore,
  };
}

export async function fetchCollectionNftsFromAlchemy(
  collectionAddress: string,
  pageKey?: string,
) {
  const params = new URLSearchParams({
    contractAddress: collectionAddress,
    withMetadata: "true",
    refreshCache: "false",
    pageSize: String(COLLECTION_NFT_PAGE_SIZE),
  });

  if (pageKey) {
    params.set("pageKey", pageKey);
  }

  const response = await fetch(`/api/alchemy/getNFTsForContract?${params}`);
  const data = await response.json();

  const items: CollectionNFTItem[] = await Promise.all(
    (data.nfts ?? []).map(async (nft: AlchemyNFT) => {
      const image = await resolveNftImage(nft.image, nft.tokenUri);
      const rawAttrs = nft.raw?.metadata?.attributes;
      const attributes = rawAttrs
        ?.filter((a) => a.trait_type && a.value != null)
        .map((a) => ({
          trait_type: a.trait_type!,
          value: a.value as string | number | boolean,
          display_type: a.display_type,
        }));
      return {
        tokenId: nft.tokenId,
        name: normalizeNftText(nft.name, `NFT #${nft.tokenId}`, 500),
        description: normalizeNftText(nft.description, "", 10_000),
        image,
        nftContract: collectionAddress,
        attributes: attributes && attributes.length > 0 ? attributes : undefined,
      };
    }),
  );

  return {
    items,
    nextPageKey: data.pageKey as string | undefined,
    totalCount: (data.totalCount as number | undefined) ?? items.length,
  };
}
