import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useAcceptOffer } from "../marketplace/useAcceptOffer";
import * as wagmi from "wagmi";
import * as viemActions from "viem/actions";
import { MARKETPLACE_ADDRESS } from "@/constants/contracts";

vi.mock("wagmi", () => ({
  useConnection: vi.fn(),
  usePublicClient: vi.fn(),
  useWriteContract: vi.fn(),
}));

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("@/lib/estimateContractGas", () => ({
  estimateContractGasWithBuffer: vi.fn().mockResolvedValue(BigInt(100000)),
}));

describe("useAcceptOffer", () => {
  const mockAddress = "0xUser";
  const mockNftContract = "0xNFTContract";
  const mockTokenId = "1";
  const mockBuyer = "0xBuyer";

  const mockMutateAsync = vi.fn();
  const mockReadContract = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (wagmi.useConnection as Mock).mockReturnValue({ address: mockAddress });
    (wagmi.usePublicClient as Mock).mockReturnValue({
      readContract: mockReadContract,
    });
    (wagmi.useWriteContract as Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
    });

    (viemActions.waitForTransactionReceipt as Mock).mockResolvedValue({});
  });

  it("should accept offer skipping approval if already approved", async () => {
    mockReadContract.mockResolvedValueOnce(true);
    mockMutateAsync.mockResolvedValueOnce("0xAcceptHash");

    const { result } = renderHook(() => useAcceptOffer());

    await act(async () => {
      await result.current.acceptOffer(
        mockNftContract as `0x${string}`,
        mockTokenId,
        mockBuyer as `0x${string}`,
      );
    });

    expect(mockReadContract).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "acceptOffer",
        args: [mockNftContract, BigInt(mockTokenId), mockBuyer],
      }),
    );

    expect(result.current.phase).toBe("idle");
    expect(result.current.isPending).toBe(false);
  });

  it("should request approval if not approved, then accept offer", async () => {
    mockReadContract.mockResolvedValueOnce(false);
    mockMutateAsync
      .mockResolvedValueOnce("0xApproveHash")
      .mockResolvedValueOnce("0xAcceptHash");

    const { result } = renderHook(() => useAcceptOffer());

    await act(async () => {
      await result.current.acceptOffer(
        mockNftContract as `0x${string}`,
        mockTokenId,
        mockBuyer as `0x${string}`,
      );
    });

    expect(mockReadContract).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: "setApprovalForAll",
        args: [MARKETPLACE_ADDRESS, true],
      }),
    );
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: "acceptOffer",
        args: [mockNftContract, BigInt(mockTokenId), mockBuyer],
      }),
    );
  });

  it("should throw error if already in progress", async () => {
    mockReadContract.mockResolvedValue(true);
    let resolveTx: (val: unknown) => void;
    mockMutateAsync.mockReturnValue(
      new Promise((r) => {
        resolveTx = r;
      }),
    );

    const { result } = renderHook(() => useAcceptOffer());

    let promise: Promise<void>;
    act(() => {
      promise = result.current.acceptOffer(
        mockNftContract as `0x${string}`,
        mockTokenId,
        mockBuyer as `0x${string}`,
      );
    });

    await act(async () => {
      await expect(
        result.current.acceptOffer(
          mockNftContract as `0x${string}`,
          mockTokenId,
          mockBuyer as `0x${string}`,
        ),
      ).rejects.toThrow("Accept offer already in progress.");
    });

    resolveTx!("0xHash");
    await act(async () => {
      await promise;
    });
  });

  it("should throw error if no network connection", async () => {
    (wagmi.useConnection as Mock).mockReturnValue({ address: undefined });
    const { result } = renderHook(() => useAcceptOffer());
    await act(async () => {
      await expect(
        result.current.acceptOffer(
          mockNftContract as `0x${string}`,
          mockTokenId,
          mockBuyer as `0x${string}`,
        ),
      ).rejects.toThrow("No network connection.");
    });
  });
});
