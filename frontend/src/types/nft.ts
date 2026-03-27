// ─── Base NFT ─────────────────────────────────────────────────────────────────

export interface NFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  nftContract: string;
  collectionName?: string;
}

// ─── NFT with market data (explore / listings) ────────────────────────────────

export interface NFTItemWithMarket extends NFTItem {
  listingPrice: string | null;
  topOffer: string | null;
  seller: string | null;
}

// ─── NFT inside a collection ──────────────────────────────────────────────────

export interface CollectionNFTItem {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  nftContract: string;
  collectionName?: string;
}

// ─── NFT created by the connected user ────────────────────────────────────────

export interface CreatedNFTItem extends CollectionNFTItem {
  collectionName: string;
}

// ─── Favorite reference stored in localStorage ────────────────────────────────

export type FavoriteRef = { nftContract: string; tokenId: string };
