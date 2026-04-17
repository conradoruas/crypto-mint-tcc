import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  HttpRequestError,
  InsufficientFundsError,
  RpcRequestError,
  TimeoutError,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from "viem";

export type TransactionErrorKind =
  | "user_rejected"
  | "insufficient_funds"
  | "nonce_expired"
  | "gas_too_low"
  | "unauthorized"
  | "rate_limit"
  | "reverted"
  | "network"
  | "unknown";

function walkErrorChain(error: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = error;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isUserRejectedNode(node: unknown): boolean {
  if (node instanceof UserRejectedRequestError) return true;
  if (typeof node !== "object" || node === null) return false;
  const code = (node as { code?: number }).code;
  return code === UserRejectedRequestError.code || code === 5000; // CAIP-25 user reject
}

function isUserRejectedMessage(msg: string): boolean {
  return /user rejected|rejected the request|denied transaction signature|action rejected|request rejected|user denied|cancelled by user|canceled by user|ethers-user-denied|rejected from user/i.test(
    msg,
  );
}

function isNetworkMessage(msg: string): boolean {
  return /failed to fetch|networkerror|load failed|fetch.*network|socket hang up|econnrefused|econnreset|timeout|internet connection|offline|upstream json-rpc error/i.test(
    msg,
  );
}

function isInsufficientFundsMessage(msg: string): boolean {
  return /insufficient funds|exceeds the balance|gas required exceeds|have 0 want/i.test(
    msg,
  );
}

function isRevertMessage(msg: string): boolean {
  return (
    /execution reverted|transaction reverted|revert|require|VM Exception/i.test(
      msg,
    ) && !isUserRejectedMessage(msg)
  );
}

function isNonceMessage(msg: string): boolean {
  return /nonce too low|nonce out of order|nonce too high/i.test(msg);
}

function isGasTooLowMessage(msg: string): boolean {
  return /intrinsic gas too low|replacement transaction underpriced|max fee per gas less than/i.test(
    msg,
  );
}

function isUnauthorizedMessage(msg: string): boolean {
  return /caller is not the owner|missing role|not authorized|only owner|not permitted/i.test(
    msg,
  );
}

function isRateLimitMessage(msg: string): boolean {
  return /too many requests|rate limit exceeded|429/i.test(msg);
}

/** Classify a wagmi/viem (or wrapped) error for UX and logging. */
export function getTransactionErrorKind(error: unknown): TransactionErrorKind {
  for (const node of walkErrorChain(error)) {
    if (isUserRejectedNode(node)) return "user_rejected";
    if (node instanceof InsufficientFundsError) return "insufficient_funds";
    if (node instanceof ContractFunctionRevertedError) return "reverted";
    if (node instanceof ContractFunctionExecutionError) {
      const msg = errorMessage(node);
      if (isUserRejectedMessage(msg)) return "user_rejected";
      if (isInsufficientFundsMessage(msg)) return "insufficient_funds";
      if (isUnauthorizedMessage(msg)) return "unauthorized";
      return "reverted";
    }
    if (
      node instanceof HttpRequestError ||
      node instanceof TimeoutError ||
      node instanceof WaitForTransactionReceiptTimeoutError ||
      node instanceof RpcRequestError
    ) {
      const nodeMsg = errorMessage(node);
      const nodeCode = (node as { code?: number }).code;

      if (isInsufficientFundsMessage(nodeMsg) || nodeCode === -32003)
        return "insufficient_funds";
      if (isUserRejectedMessage(nodeMsg)) return "user_rejected";
      if (isNonceMessage(nodeMsg) || nodeCode === -32000) return "nonce_expired";
      if (isGasTooLowMessage(nodeMsg)) return "gas_too_low";
      if (isUnauthorizedMessage(nodeMsg)) return "unauthorized";
      if (isRateLimitMessage(nodeMsg) || nodeCode === -32005) return "rate_limit";
      if (isRevertMessage(nodeMsg)) return "reverted";

      // Only return network if it doesn't look like an application error
      if (node instanceof HttpRequestError || isNetworkMessage(nodeMsg)) {
        return "network";
      }
    }
  }

  const msg = errorMessage(error);
  if (isUserRejectedMessage(msg)) return "user_rejected";
  if (isInsufficientFundsMessage(msg)) return "insufficient_funds";
  if (isNonceMessage(msg)) return "nonce_expired";
  if (isGasTooLowMessage(msg)) return "gas_too_low";
  if (isUnauthorizedMessage(msg)) return "unauthorized";
  if (isRateLimitMessage(msg)) return "rate_limit";
  if (isNetworkMessage(msg)) return "network";
  if (isRevertMessage(msg)) return "reverted";

  return "unknown";
}

function getRevertDetail(error: unknown): string | null {
  for (const node of walkErrorChain(error)) {
    if (node instanceof ContractFunctionRevertedError) {
      const r = node.reason?.trim();
      if (r && r.length > 0 && r.toLowerCase() !== "execution reverted") {
        return r.length > 160 ? `${r.slice(0, 157)}…` : r;
      }
      const firstLine = node.shortMessage?.split("\n")[0]?.trim();
      if (firstLine && firstLine.length > 0 && firstLine.length <= 180) {
        return firstLine;
      }
    }
    if (node instanceof ContractFunctionExecutionError) {
      const inner = getRevertDetail(node.cause);
      if (inner) return inner;
      const firstLine = node.shortMessage?.split("\n")[0]?.trim();
      if (firstLine && firstLine.length > 0 && firstLine.length <= 180) {
        return firstLine;
      }
    }
  }
  return null;
}

/**
 * User-safe message for contract / wallet failures.
 * Always use this in UI instead of `error.message` from the client.
 */
export function formatTransactionError(error: unknown, fallback: string): string {
  const kind = getTransactionErrorKind(error);
  switch (kind) {
    case "user_rejected":
      return "You cancelled the transaction in your wallet.";
    case "insufficient_funds":
      return "Not enough ETH for gas or this transaction.";
    case "nonce_expired":
      return "Wallet nonce out of sync. Please reset your MetaMask account (Settings > Advanced > Clear activity tab data) or wait a moment.";
    case "gas_too_low":
      return "The gas limit or price is too low for the current network congestion. Try increasing them in your wallet.";
    case "unauthorized":
      return "You are not authorized to perform this action (access control check failed).";
    case "rate_limit":
      return "Too many requests to the RPC provider. Please wait a few seconds and try again.";
    case "reverted":
      return (
        getRevertDetail(error) ??
        "The contract reverted. Check price, allowance, and balances."
      );
    case "network":
      return "Network error. Check your connection and try again.";
    default:
      return fallback;
  }
}