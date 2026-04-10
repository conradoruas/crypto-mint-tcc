import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBuyNFT } from "./useBuyNFT";
import { useContractMutation } from "../useContractMutation";
import { parseEther } from "viem";
import { MARKETPLACE_ADDRESS } from "@/constants/contracts";

vi.mock("../useContractMutation", () => ({
  useContractMutation: vi.fn(),
}));

describe("useBuyNFT", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useContractMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isConfirming: false,
      isSuccess: true,
      hash: "0xHash",
    } as any);
  });

  it("should call mutate with correct arguments to buy an NFT", async () => {
    const { result } = renderHook(() => useBuyNFT());

    const mockNftContract = "0xNFTContract";
    const mockTokenId = "10";
    const mockPrice = "0.5";

    await act(async () => {
      await result.current.buyNFT(mockNftContract as any, mockTokenId, mockPrice);
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      address: MARKETPLACE_ADDRESS,
      functionName: "buyItem",
      args: [mockNftContract, BigInt(mockTokenId)],
      value: parseEther(mockPrice),
    }));
  });

  it("should return the state of useContractMutation", () => {
    const { result } = renderHook(() => useBuyNFT());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.hash).toBe("0xHash");
  });
});
