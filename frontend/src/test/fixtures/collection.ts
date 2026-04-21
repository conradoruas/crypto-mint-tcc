import type { CollectionInfo, TrendingCollection } from "@/types/collection";
import { makeAddress } from "./wallet";

export function makeCollectionItem(
  overrides?: Partial<CollectionInfo>,
): CollectionInfo {
  return {
    contractAddress: makeAddress("c1"),
    creator: makeAddress("creator"),
    name: "Test Collection",
    symbol: "TC",
    description: "A test collection",
    image: "https://ipfs.io/ipfs/QmCollection",
    maxSupply: 1000n,
    mintPrice: 10000000000000000n,
    createdAt: 1700000000n,
    totalSupply: 10n,
    ...overrides,
  };
}

export function makeTrendingCollection(
  overrides?: Partial<TrendingCollection>,
): TrendingCollection {
  return {
    contractAddress: makeAddress("c1"),
    name: "Trending Collection",
    symbol: "TC",
    image: "https://ipfs.io/ipfs/QmTrending",
    floorPrice: "0.1",
    floorChange24h: 5.2,
    topOffer: "0.09",
    sales24h: 12,
    owners: 100,
    listedPct: "10.0",
    volume24h: "1.2",
    floorHistory: [0.08, 0.09, 0.1],
    ...overrides,
  };
}

export function makeCollectionStats(
  overrides?: Partial<{
    totalCollections: number;
    totalNFTs: number;
    totalListed: number;
    volumeETH: string;
  }>,
) {
  return {
    totalCollections: 5,
    totalNFTs: 50,
    totalListed: 10,
    volumeETH: "2.5",
    ...overrides,
  };
}
