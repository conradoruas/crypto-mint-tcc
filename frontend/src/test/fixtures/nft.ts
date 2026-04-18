import type { NFTItem, NFTItemWithMarket } from "@/types/nft";
import type { NFTMeta } from "@/types/alchemy";
import type { ListingData } from "@/types/marketplace";
import { makeAddress } from "./wallet";

export function makeNFTItem(overrides?: Partial<NFTItem>): NFTItem {
  return {
    tokenId: "1",
    name: "Test NFT #1",
    description: "A test NFT",
    image: "https://ipfs.io/ipfs/QmTest1",
    nftContract: makeAddress("a1"),
    collectionName: "Test Collection",
    ...overrides,
  };
}

export function makeNFTItemWithMarket(
  overrides?: Partial<NFTItemWithMarket>,
): NFTItemWithMarket {
  return {
    ...makeNFTItem(),
    listingPrice: null,
    topOffer: null,
    seller: null,
    ...overrides,
  };
}

export function makeNFTMetadata(overrides?: Partial<NFTMeta>): NFTMeta {
  return {
    name: "Test NFT #1",
    image: "https://ipfs.io/ipfs/QmTest1",
    ...overrides,
  };
}

export function makeNFTListing(overrides?: Partial<ListingData>): ListingData {
  return {
    seller: makeAddress("seller"),
    active: true,
    price: 1000000000000000000n,
    ...overrides,
  };
}
