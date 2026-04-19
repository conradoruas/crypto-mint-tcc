import { describe, it, expect } from "vitest";
import {
  formatTransactionError,
  getTransactionErrorKind,
} from "@/lib/txErrors";
import {
  UserRejectedRequestError,
  InsufficientFundsError,
  ContractFunctionRevertedError,
  ContractFunctionExecutionError,
  HttpRequestError,
  TimeoutError,
  RpcRequestError,
} from "viem";

// ─── getTransactionErrorKind (user rejection detection) ──────────────────────

describe("getTransactionErrorKind", () => {
  it("detects MetaMask user rejection (code 4001)", () => {
    const err = { code: 4001, message: "User rejected the request" };
    expect(getTransactionErrorKind(err)).toBe("user_rejected");
  });

  it("detects 'User rejected' in message", () => {
    expect(getTransactionErrorKind(new Error("User rejected the request."))).toBe("user_rejected");
  });

  it("detects 'user rejected' (case insensitive)", () => {
    expect(getTransactionErrorKind(new Error("user rejected transaction"))).toBe("user_rejected");
  });

  it("detects 'User denied' in message", () => {
    expect(getTransactionErrorKind(new Error("User denied transaction signature"))).toBe(
      "user_rejected",
    );
  });

  it("classifies unrelated errors as other kinds", () => {
    const kind = getTransactionErrorKind(new Error("insufficient funds"));
    expect(kind).not.toBe("user_rejected");
  });

  it("returns a kind for null/undefined", () => {
    expect(typeof getTransactionErrorKind(null)).toBe("string");
    expect(typeof getTransactionErrorKind(undefined)).toBe("string");
  });
});

// ─── formatTransactionError ─────────────────────────────────────────────────

describe("formatTransactionError", () => {
  it("returns user rejection message for rejected tx", () => {
    const err = { code: 4001, message: "User rejected" };
    const result = formatTransactionError(err, "fallback");
    expect(result.toLowerCase()).toContain("you cancelled the transaction in your wallet.");
  });

  it("returns a friendly message for generic errors", () => {
    const result = formatTransactionError(new Error("Something broke"), "Fallback msg");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles nested error.cause chains", () => {
    const inner = new Error("insufficient funds for gas");
    const outer = new Error("contract call failed");
    (outer as { cause: Error }).cause = inner;
    const result = formatTransactionError(outer, "Fallback");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns fallback message for null/undefined", () => {
    const result = formatTransactionError(null, "Default fallback");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles viem-style ContractFunctionRevertedError format", () => {
    const err = {
      name: "ContractFunctionRevertedError",
      message: "execution reverted",
      data: { message: "NFT nao esta a venda" },
    };
    const result = formatTransactionError(err, "Fallback");
    expect(typeof result).toBe("string");
  });

  it("detects 'insufficient funds' errors", () => {
    const err = new Error("insufficient funds for intrinsic transaction cost");
    const result = formatTransactionError(err, "Fallback");
    expect(result.toLowerCase()).toContain("not enough eth for gas or this transaction.");
  });

  it("returns nonce_expired message", () => {
    const result = formatTransactionError(new Error("nonce too low"), "Fallback");
    expect(result.toLowerCase()).toContain("nonce");
  });

  it("returns gas_too_low message", () => {
    const result = formatTransactionError(new Error("intrinsic gas too low"), "Fallback");
    expect(result.toLowerCase()).toContain("gas");
  });

  it("returns unauthorized message", () => {
    const result = formatTransactionError(new Error("caller is not the owner"), "Fallback");
    expect(result.toLowerCase()).toContain("not authorized");
  });

  it("returns rate_limit message", () => {
    const result = formatTransactionError(new Error("too many requests"), "Fallback");
    expect(result.toLowerCase()).toContain("too many requests");
  });

  it("returns network message", () => {
    const result = formatTransactionError(new Error("failed to fetch"), "Fallback");
    expect(result.toLowerCase()).toContain("network");
  });

  it("returns fallback for unknown error", () => {
    const result = formatTransactionError(new Error("unknown xyz"), "My Fallback");
    expect(result).toBe("My Fallback");
  });
});

// ── getTransactionErrorKind — viem error instances ────────────────────────────

describe("getTransactionErrorKind (viem instances)", () => {
  it("detects UserRejectedRequestError", () => {
    const err = new UserRejectedRequestError(new Error("Rejected"));
    expect(getTransactionErrorKind(err)).toBe("user_rejected");
  });

  it("detects InsufficientFundsError", () => {
    const err = new InsufficientFundsError();
    expect(getTransactionErrorKind(err)).toBe("insufficient_funds");
  });

  it("detects ContractFunctionRevertedError (direct)", () => {
    const err = new ContractFunctionRevertedError({
      abi: [],
      functionName: "doSomething",
      data: undefined,
    });
    expect(getTransactionErrorKind(err)).toBe("reverted");
  });

  it("wraps ContractFunctionExecutionError and detects reverted", () => {
    const inner = new ContractFunctionRevertedError({
      abi: [],
      functionName: "doSomething",
      data: undefined,
    });
    const err = new ContractFunctionExecutionError(inner, {
      abi: [],
      contractAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      functionName: "doSomething",
    });
    expect(getTransactionErrorKind(err)).toBe("reverted");
  });

  it("detects nonce error via RpcRequestError code -32000", () => {
    const err = new RpcRequestError({
      body: {},
      error: { code: -32000, message: "nonce too low" },
      url: "http://localhost",
    });
    expect(getTransactionErrorKind(err)).toBe("nonce_expired");
  });

  it("detects rate limit via RpcRequestError code -32005", () => {
    const err = new RpcRequestError({
      body: {},
      error: { code: -32005, message: "too many requests" },
      url: "http://localhost",
    });
    expect(getTransactionErrorKind(err)).toBe("rate_limit");
  });

  it("detects insufficient funds via RpcRequestError code -32003", () => {
    const err = new RpcRequestError({
      body: {},
      error: { code: -32003, message: "insufficient funds" },
      url: "http://localhost",
    });
    expect(getTransactionErrorKind(err)).toBe("insufficient_funds");
  });

  it("detects TimeoutError as unknown (message doesn't match network regex)", () => {
    const err = new TimeoutError({ body: {}, url: "http://localhost" });
    expect(getTransactionErrorKind(err)).toBe("unknown");
  });

  it("detects HttpRequestError as network", () => {
    const err = new HttpRequestError({
      url: "http://localhost",
      status: 503,
      body: {},
      headers: new Headers(),
    });
    expect(getTransactionErrorKind(err)).toBe("network");
  });

  it("detects CAIP-25 code 5000 as user_rejected", () => {
    expect(getTransactionErrorKind({ code: 5000, message: "Rejected" })).toBe("user_rejected");
  });
});
