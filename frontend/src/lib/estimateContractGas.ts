import type { Abi, Address, PublicClient } from "viem";

/**
 * Extra gas on top of `estimateContractGas`, in basis points (10000 = 100%).
 * Default 2500 = +25% headroom for cold storage, receipt shape drift, and
 * minor state changes between estimate and mining.
 */
export const CONTRACT_GAS_BUFFER_BPS = BigInt(2500);

export type EstimateWithBufferParams = {
  account: Address;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

/**
 * RPC gas estimate with {@link CONTRACT_GAS_BUFFER_BPS}. Use for writes instead
 * of fixed limits that often under-burn on Sepolia or after contract changes.
 */
export async function estimateContractGasWithBuffer(
  publicClient: PublicClient,
  p: EstimateWithBufferParams,
): Promise<bigint> {
  const base = await publicClient.estimateContractGas({
    account: p.account,
    address: p.address,
    abi: p.abi,
    functionName: p.functionName,
    args: (p.args ?? []) as never,
    value: p.value,
  });
  const basis = BigInt(10000);
  return (base * (basis + CONTRACT_GAS_BUFFER_BPS)) / basis;
}
