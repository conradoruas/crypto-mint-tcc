import type { NftAttribute } from "./traits";

// ─── Base NFT ─────────────────────────────────────────────────────────────────

export interface NFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  nftContract: string;
  collectionName?: string;
  attributes?: NftAttribute[];
  rarityRank?: number;
  rarityScore?: number;
  rarityTier?: string;
}

// ─── NFT with market data (explore / listings) ────────────────────────────────

export interface NFTItemWithMarket extends NFTItem {
  listingPrice: string | null;
  topOffer: string | null;
  seller: string | null;
}

// ─── NFT inside a collection (structurally identical to NFTItem) ──────────────
// Kept as a named alias so call sites remain expressive about context.

export type CollectionNFTItem = NFTItem;

// ─── NFT created by the connected user (collectionName is required) ───────────

export type CreatedNFTItem = NFTItem & Required<Pick<NFTItem, "collectionName">>;

// ─── Favorite reference stored in localStorage ────────────────────────────────

export type FavoriteRef = { nftContract: string; tokenId: string };
