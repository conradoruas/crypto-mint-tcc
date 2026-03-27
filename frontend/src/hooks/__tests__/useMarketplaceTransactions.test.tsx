import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseEther } from "viem";
import { ensureAddress } from "@/lib/schemas";

// wagmi hooks are used unconditionally in the module — mock before any import
vi.mock("wagmi", () => ({
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
  useReadContract: vi
    .fn()
    .mockReturnValue({ data: undefined, refetch: vi.fn() }),
  useConnection: vi.fn().mockReturnValue({ address: undefined }),
}));

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  useListNFT,
  useBuyNFT,
  useCancelListing,
  useMakeOffer,
  useAcceptOffer,
  useCancelOffer,
} from "../useMarketplace";
import { MARKETPLACE_ADDRESS } from "@/lib/env";

// ─── Fixed test addresses ────────────────────────────────────────────────────

const NFT_CONTRACT = ensureAddress(
  "0xA000000000000000000000000000000000000001",
);
const BUYER = ensureAddress("0xB000000000000000000000000000000000000001");
const TOKEN_ID = "42";

// ─── Mock helpers ────────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn();

function setupWrite(overrides: { isPending?: boolean } = {}) {
  vi.mocked(useWriteContract).mockReturnValue({
    data: undefined,
    mutateAsync: mockMutateAsync,
    isPending: overrides.isPending ?? false,
  } as unknown as ReturnType<typeof useWriteContract>);
}

function setupReceipt(
  overrides: { isLoading?: boolean; isSuccess?: boolean } = {},
) {
  vi.mocked(useWaitForTransactionReceipt).mockReturnValue({
    isLoading: overrides.isLoading ?? false,
    isSuccess: overrides.isSuccess ?? false,
  } as unknown as ReturnType<typeof useWaitForTransactionReceipt>);
}

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockMutateAsync.mockResolvedValue("0xdeadbeef" as `0x${string}`);
  setupWrite();
  setupReceipt();
});

// ─────────────────────────────────────────────────────────────────────────────
// useListNFT
// ─────────────────────────────────────────────────────────────────────────────

describe("useListNFT", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useListNFT());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("reflects isPending=true while wallet is signing", () => {
    setupWrite({ isPending: true });
    const { result } = renderHook(() => useListNFT());

    expect(result.current.isPending).toBe(true);
  });

  it("reflects isConfirming=true while the tx is being mined", () => {
    setupReceipt({ isLoading: true });
    const { result } = renderHook(() => useListNFT());

    expect(result.current.isConfirming).toBe(true);
  });

  it("reflects isSuccess=true after on-chain confirmation", () => {
    setupReceipt({ isSuccess: true });
    const { result } = renderHook(() => useListNFT());

    expect(result.current.isSuccess).toBe(true);
  });

  it("calls setApprovalForAll (on the collection) before listItem (on the marketplace)", async () => {
    const { result } = renderHook(() => useListNFT());

    await act(() => result.current.listNFT(NFT_CONTRACT, TOKEN_ID, "0.5"));

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);

    // First call: approve the marketplace to transfer the NFT
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: NFT_CONTRACT,
        functionName: "setApprovalForAll",
        args: [MARKETPLACE_ADDRESS, true],
      }),
    );

    // Second call: list the item at the specified price
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: MARKETPLACE_ADDRESS,
        functionName: "listItem",
        args: [NFT_CONTRACT, BigInt(TOKEN_ID), parseEther("0.5")],
      }),
    );
  });

  it("converts the price string to wei via parseEther", async () => {
    const { result } = renderHook(() => useListNFT());

    await act(() => result.current.listNFT(NFT_CONTRACT, TOKEN_ID, "1.25"));

    const [, listCall] = mockMutateAsync.mock.calls;
    const args = (listCall[0] as { args: unknown[] }).args;
    expect(args[2]).toBe(parseEther("1.25")); // 1.25 ETH in wei
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useBuyNFT
// ─────────────────────────────────────────────────────────────────────────────

describe("useBuyNFT", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useBuyNFT());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("calls buyItem with the correct contract, tokenId, and ETH value", async () => {
    const { result } = renderHook(() => useBuyNFT());

    await act(() => result.current.buyNFT(NFT_CONTRACT, TOKEN_ID, "1.5"));

    expect(mockMutateAsync).toHaveBeenCalledOnce();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MARKETPLACE_ADDRESS,
        functionName: "buyItem",
        args: [NFT_CONTRACT, BigInt(TOKEN_ID)],
        value: parseEther("1.5"),
      }),
    );
  });

  it("converts tokenId to bigint", async () => {
    const { result } = renderHook(() => useBuyNFT());

    await act(() => result.current.buyNFT(NFT_CONTRACT, "99", "0.1"));

    const args = (mockMutateAsync.mock.calls[0][0] as { args: unknown[] }).args;
    expect(args[1]).toBe(99);
  });

  it("reflects isConfirming=true while the tx is being mined", () => {
    setupReceipt({ isLoading: true });
    const { result } = renderHook(() => useBuyNFT());

    expect(result.current.isConfirming).toBe(true);
  });

  it("reflects isSuccess=true after on-chain confirmation", () => {
    setupReceipt({ isSuccess: true });
    const { result } = renderHook(() => useBuyNFT());

    expect(result.current.isSuccess).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCancelListing
// ─────────────────────────────────────────────────────────────────────────────

describe("useCancelListing", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useCancelListing());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("calls cancelListing with the correct contract and tokenId", async () => {
    const { result } = renderHook(() => useCancelListing());

    await act(() => result.current.cancelListing(NFT_CONTRACT, TOKEN_ID));

    expect(mockMutateAsync).toHaveBeenCalledOnce();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MARKETPLACE_ADDRESS,
        functionName: "cancelListing",
        args: [NFT_CONTRACT, BigInt(TOKEN_ID)],
      }),
    );
  });

  it("reflects isPending=true while wallet is signing", () => {
    setupWrite({ isPending: true });
    const { result } = renderHook(() => useCancelListing());

    expect(result.current.isPending).toBe(true);
  });

  it("reflects isSuccess=true after on-chain confirmation", () => {
    setupReceipt({ isSuccess: true });
    const { result } = renderHook(() => useCancelListing());

    expect(result.current.isSuccess).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useMakeOffer
// ─────────────────────────────────────────────────────────────────────────────

describe("useMakeOffer", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useMakeOffer());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("calls makeOffer with the correct contract, tokenId, and ETH amount", async () => {
    const { result } = renderHook(() => useMakeOffer());

    await act(() => result.current.makeOffer(NFT_CONTRACT, TOKEN_ID, "0.25"));

    expect(mockMutateAsync).toHaveBeenCalledOnce();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MARKETPLACE_ADDRESS,
        functionName: "makeOffer",
        args: [NFT_CONTRACT, BigInt(TOKEN_ID)],
        value: parseEther("0.25"),
      }),
    );
  });

  it("converts the offer amount string to wei via parseEther", async () => {
    const { result } = renderHook(() => useMakeOffer());

    await act(() => result.current.makeOffer(NFT_CONTRACT, TOKEN_ID, "0.001"));

    const call = mockMutateAsync.mock.calls[0][0] as { value: bigint };
    expect(call.value).toBe(parseEther("0.001"));
  });

  it("reflects isConfirming=true while the tx is being mined", () => {
    setupReceipt({ isLoading: true });
    const { result } = renderHook(() => useMakeOffer());

    expect(result.current.isConfirming).toBe(true);
  });

  it("reflects isSuccess=true after on-chain confirmation", () => {
    setupReceipt({ isSuccess: true });
    const { result } = renderHook(() => useMakeOffer());

    expect(result.current.isSuccess).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useAcceptOffer
// ─────────────────────────────────────────────────────────────────────────────

describe("useAcceptOffer", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useAcceptOffer());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("calls setApprovalForAll (on the collection) before acceptOffer (on the marketplace)", async () => {
    const { result } = renderHook(() => useAcceptOffer());

    await act(() => result.current.acceptOffer(NFT_CONTRACT, TOKEN_ID, BUYER));

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);

    // First call: grant marketplace operator rights so it can transfer the NFT
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: NFT_CONTRACT,
        functionName: "setApprovalForAll",
        args: [MARKETPLACE_ADDRESS, true],
      }),
    );

    // Second call: accept the specific buyer's offer
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: MARKETPLACE_ADDRESS,
        functionName: "acceptOffer",
        args: [NFT_CONTRACT, BigInt(TOKEN_ID), BUYER],
      }),
    );
  });

  it("passes the buyer address unchanged to acceptOffer", async () => {
    const { result } = renderHook(() => useAcceptOffer());

    await act(() => result.current.acceptOffer(NFT_CONTRACT, TOKEN_ID, BUYER));

    const [, acceptCall] = mockMutateAsync.mock.calls;
    const args = (acceptCall[0] as { args: unknown[] }).args;
    expect(args[2]).toBe(BUYER);
  });

  it("reflects isConfirming=true while the tx is being mined", () => {
    setupReceipt({ isLoading: true });
    const { result } = renderHook(() => useAcceptOffer());

    expect(result.current.isConfirming).toBe(true);
  });

  it("reflects isSuccess=true after on-chain confirmation", () => {
    setupReceipt({ isSuccess: true });
    const { result } = renderHook(() => useAcceptOffer());

    expect(result.current.isSuccess).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCancelOffer
// ─────────────────────────────────────────────────────────────────────────────

describe("useCancelOffer", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useCancelOffer());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("calls cancelOffer with the correct contract and tokenId", async () => {
    const { result } = renderHook(() => useCancelOffer());

    await act(() => result.current.cancelOffer(NFT_CONTRACT, TOKEN_ID));

    expect(mockMutateAsync).toHaveBeenCalledOnce();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MARKETPLACE_ADDRESS,
        functionName: "cancelOffer",
        args: [NFT_CONTRACT, BigInt(TOKEN_ID)],
      }),
    );
  });

  it("reflects isPending=true while wallet is signing", () => {
    setupWrite({ isPending: true });
    const { result } = renderHook(() => useCancelOffer());

    expect(result.current.isPending).toBe(true);
  });

  it("reflects isConfirming=true while the tx is being mined", () => {
    setupReceipt({ isLoading: true });
    const { result } = renderHook(() => useCancelOffer());

    expect(result.current.isConfirming).toBe(true);
  });

  it("reflects isSuccess=true after on-chain confirmation", () => {
    setupReceipt({ isSuccess: true });
    const { result } = renderHook(() => useCancelOffer());

    expect(result.current.isSuccess).toBe(true);
  });
});
