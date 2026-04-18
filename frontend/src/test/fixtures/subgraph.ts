import { makeAddress } from "./wallet";

export function makeCollectionStatsGql(
  overrides?: Partial<{
    id: string;
    volume24h: string;
    floorPrice: string;
    sales24h: string;
    owners: string;
    listedCount: string;
    totalSupply: string;
  }>,
) {
  return {
    id: makeAddress("c1"),
    volume24h: "1000000000000000000",
    floorPrice: "100000000000000000",
    sales24h: "5",
    owners: "50",
    listedCount: "8",
    totalSupply: "100",
    ...overrides,
  };
}

export function makeTopOffersGql(
  overrides?: Partial<{
    id: string;
    buyer: string;
    amount: string;
    expiresAt: string;
    active: boolean;
    nftContract: string;
    tokenId: string;
  }>,
) {
  return {
    id: "offer-1",
    buyer: makeAddress("buyer"),
    amount: "500000000000000000",
    expiresAt: String(Math.floor(Date.now() / 1000) + 86400),
    active: true,
    nftContract: makeAddress("a1"),
    tokenId: "1",
    ...overrides,
  };
}

export function makeActivityGql(
  overrides?: Partial<{
    id: string;
    type: string;
    nftContract: string;
    tokenId: string;
    from: string;
    to: string;
    price: string;
    txHash: string;
    blockNumber: string;
    timestamp: string;
  }>,
) {
  return {
    id: "activity-1",
    type: "sale",
    nftContract: makeAddress("a1"),
    tokenId: "1",
    from: makeAddress("seller"),
    to: makeAddress("buyer"),
    price: "1000000000000000000",
    txHash: "0x" + "a".repeat(64),
    blockNumber: "1000",
    timestamp: "1700000000",
    ...overrides,
  };
}
