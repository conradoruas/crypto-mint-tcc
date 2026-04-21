import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionOwnerActions } from "./useCollectionOwnerActions";

const mockRefetchBalance = vi.fn();
const mockWithdrawWrite = vi.fn();
const mockCommitSeedWrite = vi.fn();
const mockEstimateGas = vi.fn();
const mockGenerateSeed = vi.fn();

let mockWithdrawReceipt = { isLoading: false, isSuccess: false };
let mockCommitReceipt = { isLoading: false, isSuccess: false };
let writeContractCallCount = 0;

vi.mock("wagmi", () => ({
  useBalance: vi.fn(() => ({
    data: { value: 1234000000000000000n },
    refetch: mockRefetchBalance,
  })),
  usePublicClient: vi.fn(() => ({ chain: { id: 11155111 } })),
  useWriteContract: vi.fn(() => {
    writeContractCallCount += 1;
    return writeContractCallCount % 2 === 1
      ? { mutateAsync: mockWithdrawWrite, isPending: false }
      : { mutateAsync: mockCommitSeedWrite, isPending: false };
  }),
  useWaitForTransactionReceipt: vi.fn(({ hash }: { hash?: string }) =>
    hash === "0xcommit" ? mockCommitReceipt : mockWithdrawReceipt,
  ),
}));

vi.mock("@/lib/estimateContractGas", () => ({
  estimateContractGasWithBuffer: (...args: unknown[]) => mockEstimateGas(...args),
}));

vi.mock("@/lib/mintSeed", () => ({
  generateAndStoreMintSeed: (...args: unknown[]) => mockGenerateSeed(...args),
}));

describe("useCollectionOwnerActions", () => {
  beforeEach(() => {
    writeContractCallCount = 0;
    mockWithdrawReceipt = { isLoading: false, isSuccess: false };
    mockCommitReceipt = { isLoading: false, isSuccess: false };
    mockRefetchBalance.mockReset();
    mockWithdrawWrite.mockReset();
    mockCommitSeedWrite.mockReset();
    mockEstimateGas.mockReset();
    mockGenerateSeed.mockReset();

    mockEstimateGas.mockResolvedValue(456n);
    mockWithdrawWrite.mockResolvedValue("0xwithdraw");
    mockCommitSeedWrite.mockResolvedValue("0xcommit");
    mockGenerateSeed.mockReturnValue({ commitment: "0xseed-commitment" });
  });

  it("submits withdraw transactions and refreshes balance after confirmation", async () => {
    const onMintSeedCommitted = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCollectionOwnerActions(
        "0x4000000000000000000000000000000000000004",
        "0x5000000000000000000000000000000000000005",
        onMintSeedCommitted,
      ),
    );

    await act(async () => {
      await result.current.handleWithdraw();
    });

    expect(mockEstimateGas).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        functionName: "withdraw",
      }),
    );
    expect(mockWithdrawWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "withdraw",
        gas: 456n,
      }),
    );
    expect(result.current.contractBalanceEth).toBe("1.2340");

    mockWithdrawReceipt = { isLoading: false, isSuccess: true };
    rerender();

    await waitFor(() => expect(mockRefetchBalance).toHaveBeenCalled());
  });

  it("commits the mint seed and calls back after confirmation", async () => {
    const onMintSeedCommitted = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCollectionOwnerActions(
        "0x4000000000000000000000000000000000000004",
        "0x5000000000000000000000000000000000000005",
        onMintSeedCommitted,
      ),
    );

    await act(async () => {
      await result.current.handleCommitMintSeed();
    });

    expect(mockGenerateSeed).toHaveBeenCalledWith(
      "0x4000000000000000000000000000000000000004",
    );
    expect(mockEstimateGas).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        functionName: "commitMintSeed",
        args: ["0xseed-commitment"],
      }),
    );
    expect(mockCommitSeedWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "commitMintSeed",
        args: ["0xseed-commitment"],
        gas: 456n,
      }),
    );

    mockCommitReceipt = { isLoading: false, isSuccess: true };
    rerender();

    await waitFor(() => expect(onMintSeedCommitted).toHaveBeenCalled());
  });
});
