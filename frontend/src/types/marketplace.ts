// ─── Listing / Offer (on-chain data) ─────────────────────────────────────────

export interface ListingData {
  seller: `0x${string}`;
  price: bigint;
  active: boolean;
}

export interface OfferData {
  buyer: `0x${string}`;
  amount: bigint;
  expiresAt: bigint;
  active: boolean;
}

export interface OfferWithBuyer extends OfferData {
  buyerAddress: `0x${string}`;
}

// ─── Marketplace stats ────────────────────────────────────────────────────────

export interface MarketplaceStats {
  totalCollections: number;
  totalNFTs: number;
  totalListed: number;
  volumeETH: string;
  isLoading: boolean;
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export type ActivityType =
  | "sale"
  | "listing"
  | "listing_cancelled"
  | "offer"
  | "offer_accepted"
  | "offer_cancelled"
  | "mint";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  nftContract: string;
  tokenId: string;
  from: string;
  to?: string;
  priceETH?: string;
  txHash: string;
  blockNumber: bigint;
  timestamp?: number;
}
