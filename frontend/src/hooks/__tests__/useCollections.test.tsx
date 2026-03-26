import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useCollections,
  useCollectionNFTs,
  useCreatorCollections,
  useProfileNFTs,
} from "../useCollections";
import { GET_COLLECTIONS } from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import type { MockedResponse } from "@apollo/client/testing";

// wagmi hooks are called unconditionally inside useCollections even when
// SUBGRAPH_ENABLED is true (useReadContract with enabled:false) and inside
// useCreatorCollections (useConnection). Mock the whole module.
vi.mock("wagmi", () => ({
  useReadContract: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useWriteContract: vi.fn().mockReturnValue({
    data: undefined,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useWaitForTransactionReceipt: vi.fn().mockReturnValue({
    isLoading: false,
    isSuccess: false,
  }),
  useConnection: vi.fn().mockReturnValue({ address: undefined }),
}));

import { useConnection } from "wagmi";

const makeWrapper = (mocks: MockedResponse[]) => makeApolloWrapper(mocks);

// ─── shared fixtures ─────────────────────────────────────────────────────────

const COLLECTION_1 = {
  contractAddress: "0xcollection1",
  creator: "0xcreator",
  name: "Test Collection",
  symbol: "TC",
  description: "A test collection",
  image: "https://example.com/img.png",
  maxSupply: "100",
  mintPrice: "10000000000000000",
  createdAt: "1700000000",
  totalSupply: "5",
};

const makeCollectionsMock = (
  collections: object[] = [COLLECTION_1],
): MockedResponse => ({
  request: { query: GET_COLLECTIONS },
  result: { data: { collections } },
});

// ─────────────────────────────────────────────────────────────────────────────
// useCollections
// ─────────────────────────────────────────────────────────────────────────────

describe("useCollections", () => {
  it("is loading before the query resolves", () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([]),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("returns mapped CollectionInfo from GraphQL response", async () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(1);
    const c = result.current.collections[0];
    expect(c.contractAddress).toBe("0xcollection1");
    expect(c.creator).toBe("0xcreator");
    expect(c.name).toBe("Test Collection");
    expect(c.symbol).toBe("TC");
    expect(c.description).toBe("A test collection");
    expect(c.image).toBe("https://example.com/img.png");
  });

  it("converts string fields to bigint", async () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const c = result.current.collections[0];
    expect(typeof c.maxSupply).toBe("bigint");
    expect(c.maxSupply).toBe(BigInt(100));
    expect(c.mintPrice).toBe(BigInt("10000000000000000"));
    expect(c.totalSupply).toBe(BigInt(5));
    expect(c.createdAt).toBe(BigInt("1700000000"));
  });

  it("defaults missing optional string fields to empty string and bigint fields to 0n", async () => {
    const minimal = {
      contractAddress: "0xminimal",
      creator: "0xcreator",
      name: "Minimal",
      symbol: "MIN",
    };

    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock([minimal])]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const c = result.current.collections[0];
    expect(c.description).toBe("");
    expect(c.image).toBe("");
    expect(c.maxSupply).toBe(BigInt(0));
    expect(c.mintPrice).toBe(BigInt(0));
    expect(c.totalSupply).toBe(BigInt(0));
    expect(c.createdAt).toBe(BigInt(0));
  });

  it("returns empty collections array when response is empty", async () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock([])]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(0);
  });

  it("returns multiple collections preserving order", async () => {
    const col2 = {
      ...COLLECTION_1,
      contractAddress: "0xcollection2",
      name: "Second Collection",
    };

    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock([COLLECTION_1, col2])]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(2);
    expect(result.current.collections[0].name).toBe("Test Collection");
    expect(result.current.collections[1].name).toBe("Second Collection");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCollectionNFTs
// ─────────────────────────────────────────────────────────────────────────────

describe("useCollectionNFTs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not load when collectionAddress is undefined", () => {
    const { result } = renderHook(() => useCollectionNFTs(undefined));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.nfts).toHaveLength(0);
  });

  it("maps Alchemy NFT response to CollectionNFTItem list", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nfts: [
          {
            tokenId: "1",
            name: "NFT One",
            description: "First NFT",
            image: { cachedUrl: "https://example.com/nft1.png" },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs("0xcollection1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(1);
    expect(result.current.nfts[0].tokenId).toBe("1");
    expect(result.current.nfts[0].name).toBe("NFT One");
    expect(result.current.nfts[0].description).toBe("First NFT");
    expect(result.current.nfts[0].image).toBe("https://example.com/nft1.png");
    expect(result.current.nfts[0].nftContract).toBe("0xcollection1");
  });

  it("falls back to 'NFT #<id>' when NFT has no name", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nfts: [{ tokenId: "42", image: { cachedUrl: "https://img.png" } }],
      }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs("0xcollection1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].name).toBe("NFT #42");
  });

  it("uses originalUrl when cachedUrl is absent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nfts: [{ tokenId: "1", image: { originalUrl: "https://original.png" } }],
      }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs("0xcollection1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].image).toBe("https://original.png");
  });

  it("fetches metadata from IPFS tokenUri when image is absent", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nfts: [{ tokenId: "1", tokenUri: "ipfs://QmHash" }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ image: "ipfs://QmImg" }),
      } as Response);

    const { result } = renderHook(() => useCollectionNFTs("0xcollection1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].image).toBe("https://ipfs.io/ipfs/QmImg");
  });

  it("sets totalSupply to the count of returned NFTs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        nfts: [
          { tokenId: "1", image: { cachedUrl: "https://a.png" } },
          { tokenId: "2", image: { cachedUrl: "https://b.png" } },
          { tokenId: "3", image: { cachedUrl: "https://c.png" } },
        ],
      }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs("0xcollection1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalSupply).toBe(3);
  });

  it("returns empty nfts array when response has no nfts", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nfts: [] }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs("0xcollection1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(0);
    expect(result.current.totalSupply).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCreatorCollections
// ─────────────────────────────────────────────────────────────────────────────

describe("useCreatorCollections", () => {
  afterEach(() => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined });
  });

  it("returns only collections matching the connected address", async () => {
    vi.mocked(useConnection).mockReturnValue({
      address: "0xcreator" as `0x${string}`,
    });

    const foreign = {
      ...COLLECTION_1,
      contractAddress: "0xforeign",
      creator: "0xother",
    };
    const mocks = [makeCollectionsMock([COLLECTION_1, foreign])];

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(1);
    expect(result.current.collections[0].contractAddress).toBe("0xcollection1");
  });

  it("returns empty when no wallet is connected", async () => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined });

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(0);
  });

  it("is case-insensitive when comparing creator address", async () => {
    // COLLECTION_1.creator is "0xcreator"; connected address has uppercase letters
    vi.mocked(useConnection).mockReturnValue({
      address: "0xCREATOR" as `0x${string}`,
    });

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(1);
  });

  it("returns all collections that match the creator", async () => {
    vi.mocked(useConnection).mockReturnValue({
      address: "0xcreator" as `0x${string}`,
    });

    const col2 = {
      ...COLLECTION_1,
      contractAddress: "0xcollection2",
      name: "Second",
    };
    const mocks = [makeCollectionsMock([COLLECTION_1, col2])];

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useProfileNFTs
// ─────────────────────────────────────────────────────────────────────────────

describe("useProfileNFTs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops loading immediately and returns empty nfts when ownerAddress is undefined", async () => {
    const { result } = renderHook(() => useProfileNFTs(undefined), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(0);
  });

  it("returns NFTs for owner filtered by collectionAddress", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ownedNfts: [
          {
            tokenId: "7",
            name: "Profile NFT",
            description: "Owned NFT",
            image: { cachedUrl: "https://example.com/nft7.png" },
            contract: { address: "0xcollection1" },
            collection: { name: "Test Collection" },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(
      () => useProfileNFTs("0xowner", "0xcollection1"),
      { wrapper: makeWrapper([makeCollectionsMock()]) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(1);
    expect(result.current.nfts[0].tokenId).toBe("7");
    expect(result.current.nfts[0].name).toBe("Profile NFT");
    expect(result.current.nfts[0].nftContract).toBe("0xcollection1");
    expect(result.current.nfts[0].collectionName).toBe("Test Collection");
  });

  it("falls back to 'NFT #<id>' when name is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ownedNfts: [
          {
            tokenId: "3",
            image: { cachedUrl: "https://img.png" },
            contract: { address: "0xcollection1" },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(
      () => useProfileNFTs("0xowner", "0xcollection1"),
      { wrapper: makeWrapper([makeCollectionsMock()]) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].name).toBe("NFT #3");
  });

  it("returns empty nfts when ownedNfts is empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ownedNfts: [] }),
    } as Response);

    const { result } = renderHook(
      () => useProfileNFTs("0xowner", "0xcollection1"),
      { wrapper: makeWrapper([makeCollectionsMock()]) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(0);
  });

  it("includes nftContract from contract.address field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ownedNfts: [
          {
            tokenId: "1",
            image: { cachedUrl: "https://img.png" },
            contract: { address: "0xcontractaddr" },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(
      () => useProfileNFTs("0xowner", "0xcontractaddr"),
      { wrapper: makeWrapper([makeCollectionsMock()]) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].nftContract).toBe("0xcontractaddr");
  });
});
