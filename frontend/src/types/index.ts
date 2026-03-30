// ── Types barrel ─────────────────────────────────────────────────────────
// Re-exports all shared types:
//   import { NFTItem, CollectionInfo, ListingData } from "@/types";

export type { AlchemyNFT, NFTMeta, MetaMap } from "./alchemy";
export type { CollectionInfo, TrendingCollection } from "./collection";
export type {
  ListingData,
  OfferData,
  OfferWithBuyer,
  MarketplaceStats,
  ActivityType,
  ActivityEvent,
} from "./marketplace";
export type {
  NFTItem,
  NFTItemWithMarket,
  CollectionNFTItem,
  CreatedNFTItem,
  FavoriteRef,
} from "./nft";
