import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useContractMutation } from "../useContractMutation";

// ── wagmi mocks ───────────────────────────────────────────────────────────────

const mutateAsync = vi.fn();
const useWriteContract = vi.fn();
const useWaitForTransactionReceipt = vi.fn();
const useConnection = vi.fn();
const usePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  useWriteContract: (...args: unknown[]) => useWriteContract(...args),
  useWaitForTransactionReceipt: (...args: unknown[]) =>
    useWaitForTransactionReceipt(...args),
  useConnection: () => useConnection(),
  usePublicClient: () => usePublicClient(),
}));

vi.mock("@/lib/estimateContractGas", () => ({
  estimateContractGasWithBuffer: vi.fn().mockResolvedValue(21000n),
}));

const ADDR = "0x1000000000000000000000000000000000000001" as `0x${string}`;
const STUB_ABI = [
  {
    name: "doSomething",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

function setupDefaults() {
  useWriteContract.mockReturnValue({
    data: undefined,
    mutateAsync,
    isPending: false,
    reset: vi.fn(),
  });
  useWaitForTransactionReceipt.mockReturnValue({
    isLoading: false,
    isSuccess: false,
  });
  useConnection.mockReturnValue({ address: ADDR });
  usePublicClient.mockReturnValue({ /* minimal public client shape */ });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useContractMutation", () => {
  it("returns isPending=false and isSuccess=false initially", () => {
    const { result } = renderHook(() => useContractMutation());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });

  it("throws when no network connection", async () => {
    useConnection.mockReturnValue({ address: undefined });
    usePublicClient.mockReturnValue(undefined);

    const { result } = renderHook(() => useContractMutation());

    await expect(
      act(() =>
        result.current.mutate({
          address: ADDR,
          abi: STUB_ABI,
          functionName: "doSomething",
        }),
      ),
    ).rejects.toThrow("No network connection.");
  });

  it("calls mutateAsync with gas included", async () => {
    const hash = "0xdeadbeef" as `0x${string}`;
    mutateAsync.mockResolvedValue(hash);

    const { result } = renderHook(() => useContractMutation());

    await act(() =>
      result.current.mutate({
        address: ADDR,
        abi: STUB_ABI,
        functionName: "doSomething",
      }),
    );

    expect(mutateAsync).toHaveBeenCalledOnce();
    const call = mutateAsync.mock.calls[0][0];
    expect(call.gas).toBe(21000n);
    expect(call.address).toBe(ADDR);
    expect(call.functionName).toBe("doSomething");
  });

  it("forwards value for payable calls", async () => {
    mutateAsync.mockResolvedValue("0xabc");

    const { result } = renderHook(() => useContractMutation());

    await act(() =>
      result.current.mutate({
        address: ADDR,
        abi: STUB_ABI,
        functionName: "doSomething",
        value: 1000n,
      }),
    );

    const call = mutateAsync.mock.calls[0][0];
    expect(call.value).toBe(1000n);
  });

  it("does not include value key when value is undefined", async () => {
    mutateAsync.mockResolvedValue("0xabc");

    const { result } = renderHook(() => useContractMutation());

    await act(() =>
      result.current.mutate({
        address: ADDR,
        abi: STUB_ABI,
        functionName: "doSomething",
      }),
    );

    const call = mutateAsync.mock.calls[0][0];
    expect("value" in call).toBe(false);
  });
});
