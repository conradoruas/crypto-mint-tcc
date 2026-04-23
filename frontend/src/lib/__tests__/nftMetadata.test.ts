import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchContractNFTMetadata,
  fetchBatchNFTMetadata,
  fetchBatchNFTMetadataForEvents,
  resolveNftImage,
} from "@/lib/nftMetadata";

function mockFetchJson(body: unknown, status = 200) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── fetchContractNFTMetadata ──────────────────────────────────────────────────

describe("fetchContractNFTMetadata", () => {
  it("returns map of tokenId → metadata for contract NFTs", async () => {
    mockFetchJson({
      nfts: [
        {
          tokenId: "1",
          name: "Cool NFT",
          description: "desc",
          image: { cachedUrl: "https://img.example.com/1.png" },
        },
      ],
    });

    const result = await fetchContractNFTMetadata("0xabc");
    expect(result.size).toBe(1);
    expect(result.get("1")?.name).toBe("Cool NFT");
    expect(result.get("1")?.image).toBe("https://img.example.com/1.png");
  });

  it("uses originalUrl when cachedUrl is absent", async () => {
    mockFetchJson({
      nfts: [
        {
          tokenId: "2",
          name: "NFT",
          image: { originalUrl: "https://original.com/2.png" },
        },
      ],
    });
    const result = await fetchContractNFTMetadata("0xabc");
    expect(result.get("2")?.image).toBe("https://original.com/2.png");
  });

  it("falls back to 'NFT #<id>' when name is missing", async () => {
    mockFetchJson({ nfts: [{ tokenId: "5", image: {} }] });
    const result = await fetchContractNFTMetadata("0xabc");
    expect(result.get("5")?.name).toBe("NFT #5");
  });

  it("returns empty map on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network"));
    const result = await fetchContractNFTMetadata("0xabc");
    expect(result.size).toBe(0);
  });

  it("handles missing nfts array gracefully", async () => {
    mockFetchJson({});
    const result = await fetchContractNFTMetadata("0xabc");
    expect(result.size).toBe(0);
  });

  it("fetches image from tokenUri when image fields are empty", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        // First call: getNFTsForContract — nft has tokenUri but no image
        new Response(
          JSON.stringify({
            nfts: [
              {
                tokenId: "3",
                name: "IPFS NFT",
                tokenUri: "ipfs://QmMeta3",
                image: {},
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        // Second call: fetchIpfsJson → tokenUri fetch
        new Response(
          JSON.stringify({ image: "https://img.example.com/3.png" }),
          { headers: { "content-type": "application/json" } },
        ),
      );

    const result = await fetchContractNFTMetadata("0xabc");
    expect(result.get("3")?.image).toBe("https://img.example.com/3.png");
  });

  it("can refuse non-IPFS tokenUri metadata for SSR-sensitive call sites", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const image = await resolveNftImage({}, "https://evil.example/meta.json", {
      ipfsOnlyTokenUri: true,
    });
    expect(image).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── fetchBatchNFTMetadata ─────────────────────────────────────────────────────

describe("fetchBatchNFTMetadata", () => {
  it("returns empty map for empty token list", async () => {
    const result = await fetchBatchNFTMetadata([]);
    expect(result.size).toBe(0);
  });

  it("maps contract-tokenId key to metadata", async () => {
    mockFetchJson({
      nfts: [
        {
          tokenId: "1",
          name: "Batch NFT",
          contract: { address: "0xCONTRACT" },
          image: { cachedUrl: "https://img.example.com/b1.png" },
        },
      ],
    });

    const result = await fetchBatchNFTMetadata([
      { contractAddress: "0xCONTRACT", tokenId: "1" },
    ]);
    expect(result.get("0xcontract-1")?.name).toBe("Batch NFT");
  });

  it("returns empty map on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network"));
    const result = await fetchBatchNFTMetadata([
      { contractAddress: "0xabc", tokenId: "1" },
    ]);
    expect(result.size).toBe(0);
  });
});

// ── fetchBatchNFTMetadataForEvents ────────────────────────────────────────────

describe("fetchBatchNFTMetadataForEvents", () => {
  it("deduplicates events before calling batch endpoint", async () => {
    mockFetchJson({ nfts: [] });
    await fetchBatchNFTMetadataForEvents([
      { nftContract: "0xabc", tokenId: "1" },
      { nftContract: "0xABC", tokenId: "1" }, // duplicate (case-insensitive)
      { nftContract: "0xabc", tokenId: "2" },
    ]);
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.tokens).toHaveLength(2);
  });
});

describe("resolveNftImage", () => {
  it("returns empty string for hostile direct image URLs", async () => {
    const image = await resolveNftImage(
      { originalUrl: "javascript:alert(1)" },
      undefined,
    );
    expect(image).toBe("");
  });
});
