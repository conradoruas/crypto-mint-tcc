import type { NFTItemWithMarket } from "@/types/nft";

export type { NFTItemWithMarket };

export type GqlListing = {
  id: string;
  price: string;
  active: boolean;
  seller: string;
};

export type GqlOffer = {
  id: string;
  amount: string;
  buyer: string;
  expiresAt?: string;
};

export type GqlNFT = {
  id: string;
  tokenId: string;
  tokenUri?: string;
  owner: string;
  collection?: {
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
  };
  listing?: GqlListing | null;
  offers?: GqlOffer[];
};

export type GqlNFTsData = { nfts: GqlNFT[] };

export type ExploreVariant = "collection" | "market";
