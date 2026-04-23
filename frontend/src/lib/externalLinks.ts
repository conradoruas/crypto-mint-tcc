import { isAddress } from "viem";

const ETHERSCAN_HOST = "https://sepolia.etherscan.io";

function isTxHash(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function buildEtherscanAddressUrl(address: string | null | undefined) {
  if (!address || !isAddress(address)) return null;
  return `${ETHERSCAN_HOST}/address/${address}`;
}

export function buildEtherscanTxUrl(hash: string | null | undefined) {
  if (!isTxHash(hash)) return null;
  return `${ETHERSCAN_HOST}/tx/${hash}`;
}

export function openSafeExternalUrl(url: string | null | undefined) {
  if (!url || typeof window === "undefined") return;
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) popup.opener = null;
}
