import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAcceptOffer } from "./useAcceptOffer";
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
  estimateContractGasWithBuffer: vi.fn().mockResolvedValue(100000n),
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

    vi.mocked(wagmi.useConnection).mockReturnValue({ address: mockAddress } as any);
    vi.mocked(wagmi.usePublicClient).mockReturnValue({
      readContract: mockReadContract,
    } as any);
    vi.mocked(wagmi.useWriteContract).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as any);

    vi.mocked(viemActions.waitForTransactionReceipt).mockResolvedValue({} as any);
  });

  it("should accept offer skipping approval if already approved", async () => {
    mockReadContract.mockResolvedValueOnce(true); 
    mockMutateAsync.mockResolvedValueOnce("0xAcceptHash");

    const { result } = renderHook(() => useAcceptOffer());

    await act(async () => {
      await result.current.acceptOffer(mockNftContract as any, mockTokenId, mockBuyer as any);
    });

    expect(mockReadContract).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "acceptOffer",
      args: [mockNftContract, BigInt(mockTokenId), mockBuyer],
    }));
    
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
      await result.current.acceptOffer(mockNftContract as any, mockTokenId, mockBuyer as any);
    });

    expect(mockReadContract).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: "setApprovalForAll", args: [MARKETPLACE_ADDRESS, true] })
    );
    expect(mockMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: "acceptOffer", args: [mockNftContract, BigInt(mockTokenId), mockBuyer] })
    );
  });

  it("should throw error if already in progress", async () => {
    mockReadContract.mockResolvedValue(true);
    let resolveTx: (val: any) => void;
    mockMutateAsync.mockReturnValue(new Promise((r) => { resolveTx = r; }));

    const { result } = renderHook(() => useAcceptOffer());

    let promise;
    act(() => {
      promise = result.current.acceptOffer(mockNftContract as any, mockTokenId, mockBuyer as any);
    });

    await act(async () => {
      await expect(result.current.acceptOffer(mockNftContract as any, mockTokenId, mockBuyer as any)).rejects.toThrow(
        "Accept offer already in progress."
      );
    });

    resolveTx!("0xHash");
    await act(async () => { await promise; });
  });

  it("should throw error if no network connection", async () => {
    vi.mocked(wagmi.useConnection).mockReturnValue({ address: undefined } as any);
    const { result } = renderHook(() => useAcceptOffer());
    await act(async () => {
      await expect(result.current.acceptOffer(mockNftContract as any, mockTokenId, mockBuyer as any)).rejects.toThrow(
        "No network connection."
      );
    });
  });
});
