import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMarketplaceStats } from "../useMarketplaceStats";
import { GET_MARKETPLACE_STATS } from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import { MockLink } from "@apollo/client/testing";

type MockedResponse = MockLink.MockedResponse;

const makeWrapper = (mocks: MockedResponse[]) => makeApolloWrapper(mocks);

const makeStatsMock = (): MockedResponse => ({
  request: { query: GET_MARKETPLACE_STATS },
  result: { data: { marketplaceStats: null } },
});

describe("useMarketplaceStats", () => {
  it("is loading before the query resolves", () => {
    const { result } = renderHook(() => useMarketplaceStats(), {
      wrapper: makeWrapper([makeStatsMock()]),
    });

    // Checked synchronously — mock exists but hasn't resolved yet
    expect(result.current.isLoading).toBe(true);
  });

  it("returns parsed stats from the GraphQL response", async () => {
    const mocks = [
      {
        request: { query: GET_MARKETPLACE_STATS },
        result: {
          data: {
            marketplaceStats: {
              totalCollections: "5",
              totalNFTs: "42",
              totalListed: "10",
              totalVolume: "1000000000000000000", // 1 ETH in wei
              totalSales: "3",
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useMarketplaceStats(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalCollections).toBe(5);
    expect(result.current.totalNFTs).toBe(42);
    expect(result.current.totalListed).toBe(10);
    expect(result.current.volumeETH).toBe("1.0000");
  });

  it("returns zeros when marketplaceStats is null", async () => {
    const mocks = [
      {
        request: { query: GET_MARKETPLACE_STATS },
        result: { data: { marketplaceStats: null } },
      },
    ];

    const { result } = renderHook(() => useMarketplaceStats(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalCollections).toBe(0);
    expect(result.current.totalNFTs).toBe(0);
    expect(result.current.totalListed).toBe(0);
    expect(result.current.volumeETH).toBe("0");
  });

  it("formats volumeETH to 4 decimal places", async () => {
    const mocks = [
      {
        request: { query: GET_MARKETPLACE_STATS },
        result: {
          data: {
            marketplaceStats: {
              totalCollections: "1",
              totalNFTs: "1",
              totalListed: "0",
              totalVolume: "123456789000000000", // 0.123456789 ETH
              totalSales: "1",
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useMarketplaceStats(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.volumeETH).toBe("0.1235");
  });
});
