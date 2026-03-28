import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNFTOffers } from "../useMarketplace";
import { ensureAddress } from "@/lib/schemas";
import type { OfferData } from "@/types/marketplace";

const useReadContract = vi.fn();
const useReadContracts = vi.fn();

vi.mock("wagmi", () => ({
  useReadContract,
  useReadContracts,
  useConnection: vi.fn().mockReturnValue({ address: undefined }),
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

const CONTRACT = ensureAddress("0x9000000000000000000000000000000000000001");
const ADDR_BUYER_1 = ensureAddress(
  "0x1000000000000000000000000000000000000001",
);
const ADDR_BUYER_2 = ensureAddress(
  "0x2000000000000000000000000000000000000002",
);

const TOKEN_ID = "1";
const NOW = 1_700_000_000;

let dateSpy: ReturnType<typeof vi.spyOn>;

function mockOffer(
  buyer: `0x${string}`,
  active: boolean,
  amountWei: string,
  expiresAt: bigint,
): OfferData {
  return {
    buyer,
    amount: BigInt(amountWei),
    expiresAt,
    active,
  };
}

beforeEach(() => {
  dateSpy = vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
});

afterEach(() => {
  dateSpy.mockRestore();
  vi.clearAllMocks();
});

describe("useNFTOffers", () => {
  it("is loading before offer buyers resolve", () => {
    useReadContract.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID));

    expect(result.current.isLoading).toBe(true);
  });

  it("returns only non-expired active offers", async () => {
    useReadContract.mockReturnValue({
      data: [ADDR_BUYER_1, ADDR_BUYER_2],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: [
        {
          result: mockOffer(
            ADDR_BUYER_1,
            true,
            "100000000000000000",
            BigInt(NOW + 3600),
          ),
        },
        {
          result: mockOffer(
            ADDR_BUYER_2,
            true,
            "200000000000000000",
            BigInt(NOW - 1),
          ),
        },
      ],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(1);
    expect(result.current.offers[0]!.buyerAddress).toBe(ADDR_BUYER_1);
  });

  it("filters out inactive offers", async () => {
    useReadContract.mockReturnValue({
      data: [ADDR_BUYER_1],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: [
        {
          result: mockOffer(
            ADDR_BUYER_1,
            false,
            "100000000000000000",
            BigInt(NOW + 3600),
          ),
        },
      ],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.topOffer).toBeNull();
  });

  it("returns topOffer as the ETH value of the highest offer", async () => {
    useReadContract.mockReturnValue({
      data: [ADDR_BUYER_1, ADDR_BUYER_2],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: [
        {
          result: {
            buyer: ADDR_BUYER_1,
            amount: BigInt("500000000000000000"),
            expiresAt: BigInt(NOW + 7200),
            active: true,
          } satisfies OfferData,
        },
        {
          result: {
            buyer: ADDR_BUYER_2,
            amount: BigInt("100000000000000000"),
            expiresAt: BigInt(NOW + 3600),
            active: true,
          } satisfies OfferData,
        },
      ],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.topOffer).toBe("0.5");
    expect(result.current.offers).toHaveLength(2);
  });

  it("returns null topOffer when all offers are expired", async () => {
    useReadContract.mockReturnValue({
      data: [ADDR_BUYER_1],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: [
        {
          result: mockOffer(
            ADDR_BUYER_1,
            true,
            "100000000000000000",
            BigInt(NOW - 60),
          ),
        },
      ],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.topOffer).toBeNull();
  });

  it("returns empty offers when there are no buyers", async () => {
    useReadContract.mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers(CONTRACT, TOKEN_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.topOffer).toBeNull();
  });

  it("does not load when contract is empty", () => {
    useReadContract.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useReadContracts.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useNFTOffers("", TOKEN_ID));

    expect(result.current.offers).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });
});
