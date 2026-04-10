import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useListNFT } from "./useListNFT";
import * as wagmi from "wagmi";
import * as viemActions from "viem/actions";
import { MARKETPLACE_ADDRESS } from "@/constants/contracts";
import { parseEther } from "viem";

vi.mock("wagmi", () => ({
  useConnection: vi.fn(),
  usePublicClient: vi.fn(),
  useWriteContract: vi.fn(),
}));

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
}));

// Mock estimateContractGas with its buffer to avoid complex viem internal mocks
vi.mock("@/lib/estimateContractGas", () => ({
  estimateContractGasWithBuffer: vi.fn().mockResolvedValue(BigInt(100000)),
}));

describe("useListNFT", () => {
  const mockAddress = "0xUser";
  const mockNftContract = "0xNFTContract";
  const mockTokenId = "1";
  const mockPriceInEth = "0.1";

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

  it("should list NFT skipping approval if already approved", async () => {
    mockReadContract.mockResolvedValueOnce(true); // isApprovedForAll returns true
    mockMutateAsync.mockResolvedValueOnce("0xListHash");

    const { result } = renderHook(() => useListNFT());

    await act(async () => {
        await result.current.listNFT(mockNftContract, mockTokenId, mockPriceInEth);
    });

    expect(mockReadContract).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "listItem",
      args: [mockNftContract, BigInt(mockTokenId), parseEther(mockPriceInEth)],
    }));
    
    // Check state transition ended in idle
    expect(result.current.phase).toBe("idle");
    expect(result.current.isPending).toBe(false);
  });

  it("should request approval if not approved, then list NFT", async () => {
    mockReadContract.mockResolvedValueOnce(false); // isApprovedForAll returns false
    mockMutateAsync
      .mockResolvedValueOnce("0xApproveHash")
      .mockResolvedValueOnce("0xListHash");

    const { result } = renderHook(() => useListNFT());

    const promise = act(async () => {
      await result.current.listNFT(mockNftContract, mockTokenId, mockPriceInEth);
    });

    // We can't easily wait for internal state transitions without intermediate hooks,
    // but we can ensure everything was called properly.
    await promise;

    expect(mockReadContract).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: "setApprovalForAll", args: [MARKETPLACE_ADDRESS, true] })
    );
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: "listItem" })
    );
    expect(result.current.phase).toBe("idle");
  });

  it("should throw error if already in progress", async () => {
    mockReadContract.mockResolvedValue(true);
    // Make mutateAsync delay so the hook stays in pending state
    let resolveTx: (val: unknown) => void;
    mockMutateAsync.mockReturnValue(new Promise((r) => { resolveTx = r; }));

    const { result } = renderHook(() => useListNFT());

    let promise1: Promise<void>;
    act(() => {
      promise1 = result.current.listNFT(mockNftContract, mockTokenId, mockPriceInEth);
    });

    await act(async () => {
      await expect(result.current.listNFT(mockNftContract, mockTokenId, mockPriceInEth)).rejects.toThrow(
        "Listing already in progress."
      );
    });

    resolveTx!("0xListHash"); // let the first one finish
    await act(async () => {
      await promise1;
    });
  });

  it("should throw error if no network connection", async () => {
    (wagmi.useConnection as Mock).mockReturnValue({ address: undefined });

    const { result } = renderHook(() => useListNFT());

    await act(async () => {
      await expect(result.current.listNFT(mockNftContract, mockTokenId, mockPriceInEth)).rejects.toThrow(
        "No network connection."
      );
    });
  });
});
