import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNFTOffers } from "../useMarketplace";
import { GET_OFFERS_FOR_NFT } from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import { MockLink } from "@apollo/client/testing";

type MockedResponse = MockLink.MockedResponse;

const CONTRACT = "0xcontract";
const TOKEN_ID = "1";
const NOW = 1_700_000_000; // fixed unix timestamp

const makeWrapper = (mocks: MockedResponse[]) => makeApolloWrapper(mocks);

const mockRequest = {
  query: GET_OFFERS_FOR_NFT,
  variables: { nftContract: CONTRACT.toLowerCase(), tokenId: TOKEN_ID },
};

// Spy on Date.now so the expiry comparisons inside the hook are deterministic.
// Using spyOn (not fake timers) preserves async behaviour required by waitFor.
let dateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  dateSpy = vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
});

afterEach(() => {
  dateSpy.mockRestore();
});

describe("useNFTOffers", () => {
  it("is loading before the query resolves", () => {
    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeWrapper([{ request: mockRequest, result: { data: { offers: [] } } }]),
    });

    // Checked synchronously — mock exists but hasn't resolved yet
    expect(result.current.isLoading).toBe(true);
  });

  it("returns only non-expired active offers", async () => {
    const mocks = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: "0xvalid",
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600), // 1 h from now — valid
                active: true,
              },
              {
                id: "2",
                buyer: "0xexpired",
                amount: "200000000000000000",
                expiresAt: String(NOW - 1), // 1 s ago — expired
                active: true,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(1);
    expect(result.current.offers[0].buyerAddress).toBe("0xvalid");
  });

  it("filters out inactive offers", async () => {
    const mocks = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: "0xbuyer",
                amount: "100000000000000000",
                expiresAt: String(NOW + 3600),
                active: false, // inactive
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.topOffer).toBeNull();
  });

  it("returns topOffer as the ETH value of the first (highest) offer", async () => {
    // GraphQL returns them pre-sorted by amount desc — highest first
    const mocks = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "2",
                buyer: "0xwhale",
                amount: "500000000000000000", // 0.5 ETH — highest
                expiresAt: String(NOW + 7200),
                active: true,
              },
              {
                id: "1",
                buyer: "0xother",
                amount: "100000000000000000", // 0.1 ETH
                expiresAt: String(NOW + 3600),
                active: true,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.topOffer).toBe("0.5");
    expect(result.current.offers).toHaveLength(2);
  });

  it("returns null topOffer when all offers are expired", async () => {
    const mocks = [
      {
        request: mockRequest,
        result: {
          data: {
            offers: [
              {
                id: "1",
                buyer: "0xbuyer",
                amount: "100000000000000000",
                expiresAt: String(NOW - 60), // expired 1 min ago
                active: true,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.topOffer).toBeNull();
  });

  it("returns empty offers and null topOffer for empty query result", async () => {
    const mocks = [
      {
        request: mockRequest,
        result: { data: { offers: [] } },
      },
    ];

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.topOffer).toBeNull();
  });

  it("skips the query when contract is empty", () => {
    const { result } = renderHook(() => useNFTOffers("", TOKEN_ID), {
      wrapper: makeWrapper([]),
    });

    // With skip=true, loading stays false and offers stays empty
    expect(result.current.offers).toHaveLength(0);
  });
});
