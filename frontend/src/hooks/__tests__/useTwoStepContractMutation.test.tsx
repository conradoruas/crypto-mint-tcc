import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTwoStepContractMutation } from "../useTwoStepContractMutation";

// ── wagmi / viem mocks ────────────────────────────────────────────────────────

const mutateAsync = vi.fn();
const readContract = vi.fn();
const useWriteContract = vi.fn();
const useConnection = vi.fn();
const usePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  useWriteContract: (...args: unknown[]) => useWriteContract(...args),
  useConnection: () => useConnection(),
  usePublicClient: () => usePublicClient(),
}));

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/estimateContractGas", () => ({
  estimateContractGasWithBuffer: vi.fn().mockResolvedValue(21000n),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ADDR = "0x1000000000000000000000000000000000000001" as `0x${string}`;
const NFT_CONTRACT = "0x2000000000000000000000000000000000000002" as `0x${string}`;
const MARKETPLACE = "0x3000000000000000000000000000000000000003" as `0x${string}`;

const COLLECTION_ABI = [
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const MARKETPLACE_ABI = [
  {
    name: "listItem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const baseParams = {
  nftContract: NFT_CONTRACT,
  approveCheckAbi: COLLECTION_ABI,
  spender: MARKETPLACE,
  approveStep: {
    address: NFT_CONTRACT,
    abi: COLLECTION_ABI,
    functionName: "setApprovalForAll" as const,
    args: [MARKETPLACE, true] as [typeof MARKETPLACE, boolean],
  },
  execStep: {
    address: MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: "listItem" as const,
    args: [NFT_CONTRACT, 1n, 1000000000000000000n] as [typeof NFT_CONTRACT, bigint, bigint],
  },
};

function setupDefaults() {
  useWriteContract.mockReturnValue({ mutateAsync });
  useConnection.mockReturnValue({ address: USER_ADDR });
  usePublicClient.mockReturnValue({ readContract });
  readContract.mockResolvedValue(false); // not approved by default
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useTwoStepContractMutation", () => {
  it("starts in idle phase with isSuccess=false", () => {
    const { result } = renderHook(() => useTwoStepContractMutation());

    expect(result.current.phase).toBe("idle");
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("throws when no network connection", async () => {
    useConnection.mockReturnValue({ address: undefined });
    usePublicClient.mockReturnValue(undefined);

    const { result } = renderHook(() => useTwoStepContractMutation());

    await expect(
      act(() => result.current.execute(baseParams)),
    ).rejects.toThrow("No network connection.");
  });

  it("runs approve step then exec step when not yet approved", async () => {
    readContract.mockResolvedValue(false);
    mutateAsync
      .mockResolvedValueOnce("0xapproveHash")
      .mockResolvedValueOnce("0xexecHash");

    const { result } = renderHook(() => useTwoStepContractMutation());

    await act(() => result.current.execute(baseParams));

    expect(mutateAsync).toHaveBeenCalledTimes(2);
    const [approveCall, execCall] = mutateAsync.mock.calls;
    expect(approveCall[0].functionName).toBe("setApprovalForAll");
    expect(execCall[0].functionName).toBe("listItem");
  });

  it("skips approve step when already approved", async () => {
    readContract.mockResolvedValue(true); // already approved
    mutateAsync.mockResolvedValueOnce("0xexecHash");

    const { result } = renderHook(() => useTwoStepContractMutation());

    await act(() => result.current.execute(baseParams));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0].functionName).toBe("listItem");
  });

  it("sets isSuccess=true after exec completes", async () => {
    readContract.mockResolvedValue(true);
    mutateAsync.mockResolvedValueOnce("0xexecHash");

    const { result } = renderHook(() => useTwoStepContractMutation());

    await act(() => result.current.execute(baseParams));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("returns to idle phase after execution", async () => {
    readContract.mockResolvedValue(true);
    mutateAsync.mockResolvedValueOnce("0xexecHash");

    const { result } = renderHook(() => useTwoStepContractMutation());

    await act(() => result.current.execute(baseParams));

    expect(result.current.phase).toBe("idle");
    expect(result.current.isPending).toBe(false);
  });

  it("prevents concurrent executions", async () => {
    readContract.mockResolvedValue(true);
    // Never resolves — keeps the flow in-flight
    mutateAsync.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useTwoStepContractMutation());

    act(() => { void result.current.execute(baseParams); });

    await expect(
      act(() => result.current.execute({ ...baseParams, operationName: "Listing" })),
    ).rejects.toThrow("Listing already in progress.");
  });

  it("passes value to exec step when provided", async () => {
    readContract.mockResolvedValue(true);
    mutateAsync.mockResolvedValueOnce("0xexecHash");

    const { result } = renderHook(() => useTwoStepContractMutation());

    await act(() =>
      result.current.execute({
        ...baseParams,
        execStep: { ...baseParams.execStep, value: 500n },
      }),
    );

    const execCall = mutateAsync.mock.calls[0][0];
    expect(execCall.value).toBe(500n);
  });
});
