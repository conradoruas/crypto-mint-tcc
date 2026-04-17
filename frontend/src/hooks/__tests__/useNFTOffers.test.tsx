import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNFTOffers } from "../marketplace";
import { GET_OFFERS_FOR_NFT } from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import type { MockLink } from "@apollo/client/testing";
import { ensureAddressOrZero } from "@/lib/schemas";
import type { OfferData } from "@/types/marketplace";

type MockedResponse = MockLink.MockedResponse;

const useReadContract = vi.fn();
const useReadContracts = vi.fn();
const useConnection = vi.fn().mockReturnValue({ address: undefined });

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => useReadContract(...args),
  useReadContracts: (...args: unknown[]) => useReadContracts(...args),
  useConnection: () => useConnection(),
  usePublicClient: vi.fn(),
  useWriteContract: vi.fn().mockReturnValue({
    data: undefined,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useWaitForTransactionReceipt: vi.fn().mockReturnValue({
    isLoading: false,
    isSuccess: false,
  }),
}));

const CONTRACT = ensureAddressOrZero("0x9000000000000000000000000000000000000001");
const ADDR_BUYER_1 = ensureAddressOrZero(
  "0x1000000000000000000000000000000000000001",
);
const ADDR_BUYER_2 = ensureAddressOrZero(
  "0x2000000000000000000000000000000000000002",
);
const ADDR_BUYER_3 = ensureAddressOrZero(
  "0x3000000000000000000000000000000000000003",
);

const TOKEN_ID = "1";
const NOW = 1_700_000_000;

// nowBucketed = Math.floor(NOW * 1000 / 60000) * 60
const NOW_BUCKETED = Math.floor((NOW * 1000) / 60000) * 60;

const mockRequest = {
  query: GET_OFFERS_FOR_NFT,
  variables: {
    nftContract: CONTRACT.toLowerCase(),
    tokenId: TOKEN_ID,
    now: NOW_BUCKETED,
  },
};

let dateSpy: ReturnType<typeof vi.spyOn>;

function defaultWagmiMocks() {
  useReadContract.mockReturnValue({
    data: undefined,
    refetch: vi.fn(),
  });
  useReadContracts.mockReturnValue({
    data: undefined,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  dateSpy = vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
  defaultWagmiMocks();
});

afterEach(() => {
  dateSpy.mockRestore();
  vi.clearAllMocks();
});

describe("useNFTOffers", () => {
  it("is loading only before first indexer response (not while RPC is in flight)", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_1,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
            ],
          },
        },
      },
    ];

    useReadContract.mockReturnValue({
      data: undefined,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: undefined,
      refetch: vi.fn(),
    });
    useConnection.mockReturnValue({ address: undefined });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.offers).toHaveLength(1);
  });

  it("shows subgraph offers when chain buyers are not loaded yet", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_1,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
            ],
          },
        },
      },
    ];

    useReadContract.mockReturnValue({
      data: undefined,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    await waitFor(() => expect(result.current.offers.length).toBe(1));
    expect(result.current.offers[0]!.buyerAddress).toBe(ADDR_BUYER_1);
  });

  it("uses subgraph data when SUBGRAPH_ENABLED (RPC disabled)", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_1,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
            ],
          },
        },
      },
    ];

    // RPC mocks should be ignored when subgraph is enabled
    useReadContract.mockReturnValue({
      data: [ADDR_BUYER_1],
      refetch: vi.fn(),
    });
    const onChain: OfferData = {
      buyer: ADDR_BUYER_1,
      amount: BigInt("777000000000000000"),
      expiresAt: BigInt(NOW + 3600),
      active: true,
    };
    useReadContracts.mockReturnValue({
      data: [{ result: onChain }],
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    // Should use subgraph amount, not on-chain
    await waitFor(() =>
      expect(result.current.offers[0]?.amount).toBe(
        BigInt("100000000000000000"),
      ),
    );
  });

  it("keeps subgraph offer when RPC is disabled (subgraph enabled)", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_1,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
            ],
          },
        },
      },
    ];

    // RPC says inactive, but should be ignored when subgraph is enabled
    useReadContract.mockReturnValue({
      data: [ADDR_BUYER_1],
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: [
        {
          result: {
            buyer: ADDR_BUYER_1,
            amount: BigInt("100000000000000000"),
            expiresAt: BigInt(NOW + 3600),
            active: false,
          } satisfies OfferData,
        },
      ],
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    // Subgraph offer is kept because RPC is not used for verification
    await waitFor(() => expect(result.current.offers).toHaveLength(1));
  });

  it("returns only non-expired indexer offers", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_1,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
              {
                id: "2",
                buyer: ADDR_BUYER_2,
                amount: "200000000000000000",
                expiresAt: String(NOW - 1),
                active: true,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(1);
    expect(result.current.offers[0]!.buyerAddress).toBe(ADDR_BUYER_1);
  });

  it("filters out buyer's own offers when connected", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_1,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
            ],
          },
        },
      },
    ];

    useConnection.mockReturnValue({ address: ADDR_BUYER_1 });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.offers).toHaveLength(0);
  });

  it("returns topOffer as highest merged offer", async () => {
    const mocks: MockedResponse[] = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: ADDR_BUYER_2,
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: true,
              },
              {
                id: "2",
                buyer: ADDR_BUYER_3,
                amount: "500000000000000000",
                expiresAt: String(NOW + 7200),
                active: true,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeApolloWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.topOffer).toBe("0.5");
    expect(result.current.offers).toHaveLength(2);
  });

  it("skips query when contract is empty", () => {
    const { result } = renderHook(() => useNFTOffers("", TOKEN_ID), {
      wrapper: makeApolloWrapper([]),
    });

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });
});
