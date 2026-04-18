import { describe, it, expect, vi } from "vitest";
import {
  estimateContractGasWithBuffer,
  CONTRACT_GAS_BUFFER_BPS,
} from "@/lib/estimateContractGas";
import type { PublicClient } from "viem";

const makeClient = (estimate: bigint) =>
  ({
    estimateContractGas: vi.fn().mockResolvedValue(estimate),
  }) as unknown as PublicClient;

const baseParams = {
  account: "0x1000000000000000000000000000000000000001" as `0x${string}`,
  address: "0x2000000000000000000000000000000000000002" as `0x${string}`,
  abi: [] as const,
  functionName: "doSomething",
};

describe("estimateContractGasWithBuffer", () => {
  it("adds CONTRACT_GAS_BUFFER_BPS basis points on top of estimate", async () => {
    const base = 100_000n;
    const client = makeClient(base);
    const result = await estimateContractGasWithBuffer(client, baseParams);
    const expected = (base * (10000n + CONTRACT_GAS_BUFFER_BPS)) / 10000n;
    expect(result).toBe(expected);
  });

  it("default buffer is 25% (2500 bps)", async () => {
    expect(CONTRACT_GAS_BUFFER_BPS).toBe(2500n);
    const base = 80_000n;
    const client = makeClient(base);
    const result = await estimateContractGasWithBuffer(client, baseParams);
    expect(result).toBe(100_000n);
  });

  it("forwards args to estimateContractGas", async () => {
    const client = makeClient(21_000n);
    await estimateContractGasWithBuffer(client, {
      ...baseParams,
      args: ["arg1"],
      value: 500n,
    });
    const call = (client.estimateContractGas as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.value).toBe(500n);
  });

  it("passes empty array for missing args", async () => {
    const client = makeClient(21_000n);
    await estimateContractGasWithBuffer(client, baseParams);
    const call = (client.estimateContractGas as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.args).toEqual([]);
  });
});
