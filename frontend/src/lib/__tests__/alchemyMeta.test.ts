import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchBatchNFTMetadata as fetchAlchemyMeta,
  fetchBatchNFTMetadataForEvents as fetchAlchemyMetaForEvents,
} from "../nftMetadata";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── fetchAlchemyMeta ─────────────────────────────────────────────────────────

describe("fetchAlchemyMeta", () => {
  it("returns empty map for empty token list without fetching", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await fetchAlchemyMeta([]);
    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("maps NFT by lowercased contract address + tokenId key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          nfts: [
            {
              tokenId: "1",
              name: "Cool NFT",
              contract: { address: "0xABC" },
              image: { cachedUrl: "https://cdn.example.com/nft1.png" },
            },
          ],
        }),
    } as Response);

    const result = await fetchAlchemyMeta([
      { contractAddress: "0xABC", tokenId: "1" },
    ]);

    expect(result.get("0xabc-1")).toEqual({
      name: "Cool NFT",
      image: "https://cdn.example.com/nft1.png",
    });
  });

  it("falls back to originalUrl when cachedUrl is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          nfts: [
            {
              tokenId: "2",
              name: "IPFS NFT",
              contract: { address: "0xdef" },
              image: { originalUrl: "ipfs://QmXyz" },
            },
          ],
        }),
    } as Response);

    const result = await fetchAlchemyMeta([
      { contractAddress: "0xdef", tokenId: "2" },
    ]);

    expect(result.get("0xdef-2")?.image).toBe("ipfs://QmXyz");
  });

  it("falls back to 'NFT #<id>' when name is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          nfts: [
            {
              tokenId: "5",
              contract: { address: "0x123" },
              image: {},
            },
          ],
        }),
    } as Response);

    const result = await fetchAlchemyMeta([
      { contractAddress: "0x123", tokenId: "5" },
    ]);

    expect(result.get("0x123-5")?.name).toBe("NFT #5");
  });

  it("returns empty map on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await fetchAlchemyMeta([
      { contractAddress: "0xabc", tokenId: "1" },
    ]);

    expect(result.size).toBe(0);
  });
});

// ─── fetchAlchemyMetaForEvents ────────────────────────────────────────────────

describe("fetchAlchemyMetaForEvents", () => {
  it("returns empty map for empty events without fetching", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await fetchAlchemyMetaForEvents([]);
    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("deduplicates events before calling the batch endpoint", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () => Promise.resolve({ nfts: [] }),
    } as Response);

    await fetchAlchemyMetaForEvents([
      { nftContract: "0xabc", tokenId: "1" },
      { nftContract: "0xabc", tokenId: "1" }, // duplicate — same contract + id
      { nftContract: "0xabc", tokenId: "2" },
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.tokens).toHaveLength(2);
    expect(body.tokens).toContainEqual({ contractAddress: "0xabc", tokenId: "1" });
    expect(body.tokens).toContainEqual({ contractAddress: "0xabc", tokenId: "2" });
  });

  it("is case-insensitive when deduplicating contract addresses", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () => Promise.resolve({ nfts: [] }),
    } as Response);

    await fetchAlchemyMetaForEvents([
      { nftContract: "0xABC", tokenId: "1" },
      { nftContract: "0xabc", tokenId: "1" }, // same address, different casing
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.tokens).toHaveLength(1);
  });
});
