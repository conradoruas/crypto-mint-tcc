"use client";

import { useConnection } from "wagmi";
import { sepolia } from "wagmi/chains";

/** Target chain for this app (matches `Web3Provider` / ConnectKit config). */
export const APP_CHAIN = sepolia;
export const APP_CHAIN_ID = sepolia.id;

/**
 * True when a wallet is connected but its active chain is not Sepolia.
 */
export function useWrongNetwork() {
  const { status, chainId, chain, isConnected } = useConnection();

  const isWrongNetwork =
    status === "connected" &&
    isConnected &&
    chainId !== undefined &&
    chainId !== APP_CHAIN_ID;

  return {
    isWrongNetwork,
    currentChainName: chain?.name ?? "Unknown network",
    chainId,
  };
}
