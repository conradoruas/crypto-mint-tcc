// ── Lib barrel ───────────────────────────────────────────────────────────
// Re-exports the most commonly used utilities:
//   import { resolveIpfsUrl, formatTxError, cn } from "@/lib";

export { resolveIpfsUrl } from "./ipfs";
export { cn } from "./utils";
export { formatTransactionError, getTransactionErrorKind } from "./txErrors";
export { estimateContractGasWithBuffer } from "./estimateContractGas";
export { getZodErrors, ensureAddress, parseAddress } from "./schemas";
export {
  fetchContractNFTMetadata,
  fetchBatchNFTMetadata,
  fetchBatchNFTMetadataForEvents,
} from "./nftMetadata";
export { CLIENT_UPSTREAM_FAILED, peekErrorBody } from "./apiUpstream";
export { logger } from "./logger";
