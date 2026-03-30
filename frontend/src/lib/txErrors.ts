import {
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
  return /failed to fetch|networkerror|load failed|fetch.*network|socket hang up|econnrefused|econnreset|timeout|internet connection|offline/i.test(
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

/** Classify a wagmi/viem (or wrapped) error for UX and logging. */
export function getTransactionErrorKind(error: unknown): TransactionErrorKind {
  for (const node of walkErrorChain(error)) {
    if (isUserRejectedNode(node)) return "user_rejected";
    if (node instanceof InsufficientFundsError) return "insufficient_funds";
    if (node instanceof ContractFunctionRevertedError) return "reverted";
    if (
      node instanceof HttpRequestError ||
      node instanceof TimeoutError ||
      node instanceof WaitForTransactionReceiptTimeoutError ||
      node instanceof RpcRequestError
    ) {
      return "network";
    }
  }

  const msg = errorMessage(error);
  if (isUserRejectedMessage(msg)) return "user_rejected";
  if (isNetworkMessage(msg)) return "network";
  if (isRevertMessage(msg)) return "reverted";
  if (/insufficient funds|exceeds the balance|gas required exceeds/i.test(msg))
    return "insufficient_funds";

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
      if (
        firstLine &&
        firstLine.length > 0 &&
        firstLine.length <= 180
      ) {
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