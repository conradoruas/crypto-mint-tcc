import type { NFTMeta } from "@/types/alchemy";
import type { CollectionInfo } from "@/types/collection";
import type {
  SearchCollectionResult,
  SearchNftResult,
} from "./searchResultTypes";

type GqlCollectionSuggestion = {
  id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  image: string;
  totalSupply: string;
};

type GqlNftSuggestion = {
  id: string;
  tokenId: string;
  collection: { contractAddress: string; name: string; symbol: string };
};

export function mapCollectionSuggestions(
  collections: GqlCollectionSuggestion[],
): SearchCollectionResult[] {
  return collections.slice(0, 5);
}

export function mapFallbackCollections(
  collections: CollectionInfo[],
  trimmed: string,
): SearchCollectionResult[] {
  return collections
    .filter(
      (collection) =>
        collection.name.toLowerCase().includes(trimmed) ||
        collection.symbol.toLowerCase().includes(trimmed) ||
        collection.contractAddress.toLowerCase().includes(trimmed),
    )
    .slice(0, 5)
    .map((collection) => ({
      contractAddress: collection.contractAddress,
      name: collection.name,
      symbol: collection.symbol,
      image: collection.image ?? "",
      totalSupply: collection.totalSupply?.toString() ?? undefined,
    }));
}

export function mapNftSuggestions(
  nfts: GqlNftSuggestion[],
  metaMap: Map<string, NFTMeta>,
): SearchNftResult[] {
  return nfts.map((nft) => {
    const metaKey = `${nft.collection.contractAddress.toLowerCase()}-${nft.tokenId}`;
    const meta = metaMap.get(metaKey);

    return {
      id: nft.id,
      href: `/asset/${nft.tokenId}?contract=${nft.collection.contractAddress}`,
      contractAddress: nft.collection.contractAddress,
      tokenId: nft.tokenId,
      collectionName: nft.collection.name,
      image: meta?.image ?? "",
      name: meta?.name ?? `#${nft.tokenId.padStart(3, "0")}`,
    };
  });
}
