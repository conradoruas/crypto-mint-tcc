import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useCollections,
  useCollectionNFTs,
  useCreatorCollections,
  useProfileNFTs,
  type CollectionInfo,
} from "../collections";
import { GET_COLLECTIONS } from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import { MockLink } from "@apollo/client/testing";
import { getAddress } from "viem";

type MockedResponse = MockLink.MockedResponse;

// wagmi hooks are called unconditionally inside useCollections even when
// SUBGRAPH_ENABLED is true (useReadContract with enabled:false) and inside
// useCreatorCollections (useConnection). Mock the whole module.
vi.mock("wagmi", () => ({
  useReadContract: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useReadContracts: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
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
  useConnection: vi
    .fn()
    .mockReturnValue({ address: undefined } as ReturnType<
      typeof useConnection
    >),
}));

import { useConnection } from "wagmi";

const makeWrapper = (mocks: MockedResponse[]) => makeApolloWrapper(mocks);

// ─── valid test addresses (must be 42-char hex to pass isAddress()) ───────────

const ADDR_COL1 = "0x1000000000000000000000000000000000000001" as `0x${string}`;
const ADDR_COL2 = "0x1000000000000000000000000000000000000002" as `0x${string}`;
const ADDR_CREATOR = "0xabcd000000000000000000000000000000000001" as `0x${string}`;
// getAddress computes the proper EIP-55 checksum — same address, uppercase variant for case-insensitivity test
const ADDR_CREATOR_UPPER = getAddress(ADDR_CREATOR);
const ADDR_FOREIGN = "0x3000000000000000000000000000000000000001" as `0x${string}`;
const ADDR_OTHER = "0x4000000000000000000000000000000000000001" as `0x${string}`;
const ADDR_MINIMAL = "0x5000000000000000000000000000000000000001" as `0x${string}`;
const ADDR_OWNER = "0x6000000000000000000000000000000000000001" as `0x${string}`;
const ADDR_CONTRACT = "0x7000000000000000000000000000000000000001" as `0x${string}`;

// ─── shared fixtures ─────────────────────────────────────────────────────────

const COLLECTION_1 = {
  __typename: "Collection",
  id: "some-id",
  contractAddress: ADDR_COL1,
  creator: ADDR_CREATOR,
  name: "Test Collection",
  symbol: "TC",
  description: "A test collection",
  image: "https://example.com/img.png",
  maxSupply: BigInt(100),
  mintPrice: BigInt("10000000000000000"),
  totalSupply: BigInt(5),
  createdAt: BigInt("1700000000"),
  collectionId: "some-id",
};

const makeCollectionsMock = (
  collections: CollectionInfo[] = [COLLECTION_1], // Alterado de object[] para any[] para facilitar a tipagem
): MockedResponse => ({
  request: { query: GET_COLLECTIONS, variables: { first: 100, skip: 0 } },
  result: {
    data: {
      // Garantimos que cada coleção injetada tenha o __typename
      collections: collections.map((c) => ({
        ...c,
        __typename: "Collection",
      })),
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// useCollections
// ─────────────────────────────────────────────────────────────────────────────

describe("useCollections", () => {
  it("is loading before the query resolves", () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    // Checked synchronously — mock exists but hasn't resolved yet
    expect(result.current.isLoading).toBe(true);
  });

  it("returns mapped CollectionInfo from GraphQL response", async () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(1);
    const c = result.current.collections[0];
    expect(c.contractAddress).toBe(ADDR_COL1);
    expect(c.creator).toBe(ADDR_CREATOR);
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
      contractAddress: ADDR_MINIMAL,
      creator: ADDR_CREATOR,
      name: "Minimal",
      symbol: "MIN",
      description: "",
      image: "",
      maxSupply: BigInt(0),
      mintPrice: BigInt(0),
      createdAt: BigInt(0),
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
      contractAddress: ADDR_COL2,
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
// useCollectionNFTs (subgraph path — SUBGRAPH_ENABLED is true in test env)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/apolloClient", () => ({
  apolloClient: { query: vi.fn() },
}));

import { apolloClient } from "@/lib/apolloClient";
const mockApolloQuery = vi.mocked(apolloClient.query);

/** Helper: build a subgraph response for apolloClient.query() */
function subgraphResponse(
  nfts: { tokenId: string; tokenUri?: string }[],
  totalSupply: number = nfts.length,
) {
  return {
    data: {
      collection: { totalSupply: String(totalSupply) },
      nfts: nfts.map((n) => ({ id: `nft-${n.tokenId}`, ...n })),
    },
  };
}

describe("useCollectionNFTs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockApolloQuery.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not load when collectionAddress is undefined", () => {
    const { result } = renderHook(() => useCollectionNFTs(undefined));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.nfts).toHaveLength(0);
  });

  it("maps subgraph NFT response to CollectionNFTItem list", async () => {
    mockApolloQuery.mockResolvedValue(
      subgraphResponse([{ tokenId: "1", tokenUri: "https://meta.json" }]),
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "NFT One",
        description: "First NFT",
        image: "https://example.com/nft1.png",
      }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs(ADDR_COL1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(1);
    expect(result.current.nfts[0].tokenId).toBe("1");
    expect(result.current.nfts[0].name).toBe("NFT One");
    expect(result.current.nfts[0].description).toBe("First NFT");
    expect(result.current.nfts[0].image).toBe("https://example.com/nft1.png");
    expect(result.current.nfts[0].nftContract).toBe(ADDR_COL1);
  });

  it("falls back to 'NFT #<id>' when metadata has no name", async () => {
    mockApolloQuery.mockResolvedValue(
      subgraphResponse([{ tokenId: "42", tokenUri: "https://meta42.json" }]),
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ image: "https://img.png" }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs(ADDR_COL1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].name).toBe("NFT #42");
  });

  it("resolves IPFS image from metadata", async () => {
    mockApolloQuery.mockResolvedValue(
      subgraphResponse([{ tokenId: "1", tokenUri: "ipfs://QmHash" }]),
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ image: "ipfs://QmImg" }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs(ADDR_COL1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].image).toBe("https://ipfs.io/ipfs/QmImg");
  });

  it("falls back to NFT name when tokenUri fetch fails", async () => {
    mockApolloQuery.mockResolvedValue(
      subgraphResponse([{ tokenId: "1", tokenUri: "https://broken" }]),
    );
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useCollectionNFTs(ADDR_COL1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].name).toBe("NFT #1");
    expect(result.current.nfts[0].image).toBe("");
  });

  it("sets totalSupply from the collection entity", async () => {
    mockApolloQuery.mockResolvedValue(
      subgraphResponse(
        [
          { tokenId: "1", tokenUri: "https://a.json" },
          { tokenId: "2", tokenUri: "https://b.json" },
          { tokenId: "3", tokenUri: "https://c.json" },
        ],
        10,
      ),
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ name: "N", image: "https://i.png" }),
    } as Response);

    const { result } = renderHook(() => useCollectionNFTs(ADDR_COL1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalSupply).toBe(10);
  });

  it("returns empty nfts array when subgraph returns no nfts", async () => {
    mockApolloQuery.mockResolvedValue(subgraphResponse([], 0));

    const { result } = renderHook(() => useCollectionNFTs(ADDR_COL1));

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
    vi.mocked(useConnection).mockReturnValue({
      address: undefined,
    } as ReturnType<typeof useConnection>);
  });

  it("returns only collections matching the connected address", async () => {
    vi.mocked(useConnection).mockReturnValue({
      address: ADDR_CREATOR,
    } as ReturnType<typeof useConnection>);

    const foreign = {
      ...COLLECTION_1,
      contractAddress: ADDR_FOREIGN,
      creator: ADDR_OTHER,
    };
    const mocks = [makeCollectionsMock([COLLECTION_1, foreign])];

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(1);
    expect(result.current.collections[0].contractAddress).toBe(ADDR_COL1);
  });

  it("returns empty when no wallet is connected", async () => {
    vi.mocked(useConnection).mockReturnValue({
      address: undefined,
    } as ReturnType<typeof useConnection>);

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(0);
  });

  it("is case-insensitive when comparing creator address", async () => {
    // COLLECTION_1.creator is ADDR_CREATOR (lowercase); connected address is EIP-55 checksummed (has uppercase letters)
    vi.mocked(useConnection).mockReturnValue({
      address: ADDR_CREATOR_UPPER,
    } as ReturnType<typeof useConnection>);

    const { result } = renderHook(() => useCreatorCollections(), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.collections).toHaveLength(1);
  });

  it("returns all collections that match the creator", async () => {
    vi.mocked(useConnection).mockReturnValue({
      address: ADDR_CREATOR,
    } as ReturnType<typeof useConnection>);

    const col2 = {
      ...COLLECTION_1,
      contractAddress: ADDR_COL2,
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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ownedNfts: [
          {
            tokenId: "7",
            name: "Profile NFT",
            description: "Owned NFT",
            image: { cachedUrl: "https://example.com/nft7.png" },
            contract: { address: ADDR_COL1 },
            collection: { name: "Test Collection" },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(() => useProfileNFTs(ADDR_OWNER, ADDR_COL1), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(1);
    expect(result.current.nfts[0].tokenId).toBe("7");
    expect(result.current.nfts[0].name).toBe("Profile NFT");
    expect(result.current.nfts[0].nftContract).toBe(ADDR_COL1);
    expect(result.current.nfts[0].collectionName).toBe("Test Collection");
  });

  it("falls back to 'NFT #<id>' when name is missing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ownedNfts: [
          {
            tokenId: "3",
            image: { cachedUrl: "https://img.png" },
            contract: { address: ADDR_COL1 },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(() => useProfileNFTs(ADDR_OWNER, ADDR_COL1), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].name).toBe("NFT #3");
  });

  it("returns empty nfts when ownedNfts is empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ownedNfts: [] }),
    } as Response);

    const { result } = renderHook(() => useProfileNFTs(ADDR_OWNER, ADDR_COL1), {
      wrapper: makeWrapper([makeCollectionsMock()]),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts).toHaveLength(0);
  });

  it("includes nftContract from contract.address field", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ownedNfts: [
          {
            tokenId: "1",
            image: { cachedUrl: "https://img.png" },
            contract: { address: ADDR_CONTRACT },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(
      () => useProfileNFTs(ADDR_OWNER, ADDR_CONTRACT),
      { wrapper: makeWrapper([makeCollectionsMock()]) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nfts[0].nftContract).toBe(ADDR_CONTRACT);
  });
});
