import type { TransactionReceipt } from "viem";

export function makeAddress(suffix = "01"): `0x${string}` {
  return `0x${suffix.padStart(40, "0")}` as `0x${string}`;
}

export function makeTxHash(suffix = "01"): `0x${string}` {
  return `0x${suffix.padStart(64, "0")}` as `0x${string}`;
}

export function makeReceipt(
  overrides?: Partial<TransactionReceipt>,
): TransactionReceipt {
  return {
    blockHash: makeTxHash("bb"),
    blockNumber: 1n,
    contractAddress: null,
    cumulativeGasUsed: 21000n,
    effectiveGasPrice: 1000000000n,
    from: makeAddress("aa"),
    gasUsed: 21000n,
    logs: [],
    logsBloom: "0x" + "0".repeat(512),
    status: "success",
    to: makeAddress("cc"),
    transactionHash: makeTxHash("01"),
    transactionIndex: 0,
    type: "eip1559",
    ...overrides,
  } as TransactionReceipt;
}
