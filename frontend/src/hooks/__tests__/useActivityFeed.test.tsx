import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useActivityFeed } from "../useActivityFeed";
import {
  GET_ACTIVITY_FEED_ALL,
  GET_ACTIVITY_FEED,
} from "@/lib/graphql/queries";
import { makeApolloWrapper } from "@/test/apolloWrapper";
import { MockLink } from "@apollo/client/testing";

type MockedResponse = MockLink.MockedResponse;

const makeWrapper = (mocks: MockedResponse[]) => makeApolloWrapper(mocks);

const BASE_EVENT = {
  id: "evt-1",
  type: "sale",
  nftContract: "0xcontract",
  tokenId: "1",
  from: "0xseller",
  to: "0xbuyer",
  price: "100000000000000000", // 0.1 ETH
  timestamp: "1700000000",
  txHash: "0xtxhash",
};

describe("useActivityFeed", () => {
  it("is loading before the query resolves", () => {
    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: makeWrapper([
        {
          request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 50 } },
          result: { data: { activityEvents: [] } },
        },
      ]),
    });

    // Checked synchronously — mock exists but hasn't resolved yet
    expect(result.current.isLoading).toBe(true);
  });

  it("returns all events when no filterContract is provided", async () => {
    const mocks = [
      {
        request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 50 } },
        result: { data: { activityEvents: [BASE_EVENT] } },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe("sale");
    expect(result.current.events[0].nftContract).toBe("0xcontract");
    expect(result.current.events[0].txHash).toBe("0xtxhash");
  });

  it("converts price from wei to ETH string", async () => {
    const mocks = [
      {
        request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 50 } },
        result: { data: { activityEvents: [BASE_EVENT] } },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events[0].priceETH).toBe("0.1");
  });

  it("parses timestamp as a number", async () => {
    const mocks = [
      {
        request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 50 } },
        result: { data: { activityEvents: [BASE_EVENT] } },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events[0].timestamp).toBe(1700000000);
  });

  it("sets priceETH to undefined when price is absent", async () => {
    const eventNoPrice = { ...BASE_EVENT, price: undefined };
    const mocks = [
      {
        request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 50 } },
        result: { data: { activityEvents: [eventNoPrice] } },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events[0].priceETH).toBeUndefined();
  });

  it("uses GET_ACTIVITY_FEED query when filterContract is provided", async () => {
    const CONTRACT = "0xfiltercontract";
    const mocks = [
      {
        request: {
          query: GET_ACTIVITY_FEED,
          variables: { first: 50, nftContract: CONTRACT },
        },
        result: {
          data: {
            activityEvents: [{ ...BASE_EVENT, nftContract: CONTRACT }],
          },
        },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(CONTRACT), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events[0].nftContract).toBe(CONTRACT);
  });

  it("returns empty events array when response is empty", async () => {
    const mocks = [
      {
        request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 50 } },
        result: { data: { activityEvents: [] } },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toHaveLength(0);
  });

  it("respects custom limit parameter", async () => {
    const mocks = [
      {
        request: { query: GET_ACTIVITY_FEED_ALL, variables: { first: 10 } },
        result: { data: { activityEvents: [] } },
      },
    ];

    const { result } = renderHook(() => useActivityFeed(undefined, 10), {
      wrapper: makeWrapper(mocks),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toHaveLength(0);
  });
});
