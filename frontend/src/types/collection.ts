// ─── Collection ───────────────────────────────────────────────────────────────

export interface CollectionInfo {
  contractAddress: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: bigint;
  mintPrice: bigint;
  createdAt: bigint;
  totalSupply?: bigint;
}

// ─── Trending collection (computed from sales / listings) ─────────────────────

export interface TrendingCollection {
  contractAddress: string;
  name: string;
  symbol: string;
  image: string;
  floorPrice: string | null;
  floorChange24h: number | null;
  topOffer: string | null;
  sales24h: number;
  owners: number;
  listedPct: string | null;
  volume24h: string;
  floorHistory: number[];
}
